-- NIE / CIC: independent recruitment, private drafts and no automatic role changes.
create table public.police_nie_applications (
 id uuid primary key default gen_random_uuid(),
 discord_user_id text not null check(discord_user_id ~ '^[0-9]{17,20}$'),
 discord_username text not null,
 full_name text not null check(length(full_name) between 1 and 100),
 current_rank text not null check(length(current_rank) between 1 and 100),
 personnel_name text not null, personnel_plate text not null, personnel_rank text,
 questionnaire_version integer not null default 1 check(questionnaire_version=1),
 answers jsonb not null check(jsonb_typeof(answers)='object'),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 reviewed_at timestamptz, reviewed_by text, reviewed_by_name text, review_reason text,
 check((status='pending' and reviewed_at is null and reviewed_by is null) or (status<>'pending' and reviewed_at is not null and reviewed_by is not null))
);
create unique index police_nie_one_pending on public.police_nie_applications(discord_user_id) where status='pending';
create index police_nie_status_date on public.police_nie_applications(status,created_at desc,id);
create table public.police_nie_drafts (
 id uuid primary key, discord_user_id text unique not null check(discord_user_id ~ '^[0-9]{17,20}$'),
 payload jsonb not null default '{}'::jsonb, step integer not null check(step in (2,3)),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 consumed_at timestamptz, application_id uuid references public.police_nie_applications(id)
);
alter table public.police_nie_applications enable row level security;
alter table public.police_nie_drafts enable row level security;
revoke all on public.police_nie_applications,public.police_nie_drafts from public,anon,authenticated;
grant select,insert,update,delete on public.police_nie_applications,public.police_nie_drafts to service_role;

create function public.police_nie_step(p_user text,p_operation uuid,p_step integer,p_answers jsonb,p_username text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 d public.police_nie_drafts%rowtype; a public.police_nie_applications%rowtype;
 person public.police_personnel%rowtype; v_payload jsonb; k text; keys text[]; stamp timestamptz:=now();
begin
 if p_user is null or p_user !~ '^[0-9]{17,20}$' or p_operation is null or p_step is null or p_step not in (1,2,3) or jsonb_typeof(p_answers) is distinct from 'object' then return jsonb_build_object('ok',false,'code','invalid'); end if;
 perform pg_advisory_xact_lock(hashtextextended('nie:'||p_user,0));
 select * into a from public.police_nie_applications where id=p_operation;
 if found then
  if a.discord_user_id<>p_user then return jsonb_build_object('ok',false,'code','invalid'); end if;
  return jsonb_build_object('ok',true,'submitted',true,'reference',a.id,'existing',true);
 end if;
 select * into person from public.police_personnel where discord_user_id=p_user and status='active';
 if not found then return jsonb_build_object('ok',false,'code','inactive'); end if;
 select * into a from public.police_nie_applications where discord_user_id=p_user and status='pending';
 if found then return jsonb_build_object('ok',true,'submitted',true,'reference',a.id,'existing',true); end if;
 keys:=case p_step when 1 then array['full_name','current_rank','motivation','experience'] when 2 then array['kidnapping','restraints','priority_crimes','seizure'] else array['confidentiality','evidence_integrity','terms'] end;
 foreach k in array keys loop
  if jsonb_typeof(p_answers->k) is distinct from 'string' or length(btrim(p_answers->>k)) not between 1 and (case when k in ('full_name','current_rank') then 100 else 4000 end) then return jsonb_build_object('ok',false,'code','invalid'); end if;
 end loop;
 if p_step=3 and (p_answers->>'terms') not in ('yes','no') then return jsonb_build_object('ok',false,'code','invalid'); end if;
 select * into d from public.police_nie_drafts where id=p_operation for update;
 if p_step=1 then
  if found then
   if d.discord_user_id<>p_user then return jsonb_build_object('ok',false,'code','invalid'); end if;
   if d.expires_at<=stamp then return jsonb_build_object('ok',false,'code','expired'); end if;
   return jsonb_build_object('ok',true,'step',d.step,'draft_id',d.id);
  end if;
  v_payload:='{}'::jsonb;foreach k in array keys loop v_payload:=v_payload||jsonb_build_object(k,btrim(p_answers->>k));end loop;
  insert into public.police_nie_drafts(id,discord_user_id,payload,step,expires_at) values(p_operation,p_user,v_payload,2,stamp+interval '1 hour')
  on conflict(discord_user_id) do update set id=excluded.id,payload=excluded.payload,step=2,created_at=stamp,expires_at=excluded.expires_at,consumed_at=null,application_id=null;
  return jsonb_build_object('ok',true,'step',2,'draft_id',p_operation);
 end if;
 if d.id is null or d.discord_user_id<>p_user or d.expires_at<=stamp or d.consumed_at is not null then return jsonb_build_object('ok',false,'code','expired'); end if;
 if d.step<>p_step then
  if d.step>p_step then return jsonb_build_object('ok',true,'step',d.step,'draft_id',d.id); end if;
  return jsonb_build_object('ok',false,'code','order');
 end if;
 v_payload:=d.payload;foreach k in array keys loop v_payload:=v_payload||jsonb_build_object(k,btrim(p_answers->>k));end loop;
 if p_step=2 then
  update public.police_nie_drafts set payload=v_payload,step=3 where id=d.id;
  return jsonb_build_object('ok',true,'step',3,'draft_id',d.id);
 end if;
 -- All three steps and the application are committed together; retries reuse the UUID.
 insert into public.police_nie_applications(id,discord_user_id,discord_username,full_name,current_rank,personnel_name,personnel_plate,personnel_rank,answers)
 values(d.id,p_user,left(coalesce(p_username,p_user),100),v_payload->>'full_name',v_payload->>'current_rank',person.full_name,person.plate,person.rank_name,v_payload);
 update public.police_nie_drafts set payload='{}'::jsonb,consumed_at=stamp,application_id=d.id where id=d.id;
 return jsonb_build_object('ok',true,'submitted',true,'reference',d.id);
end;
$$;
revoke all on function public.police_nie_step(text,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.police_nie_step(text,uuid,integer,jsonb,text) to service_role;
