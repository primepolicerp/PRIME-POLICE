-- Every Discord Police role holder may apply, even without a web personnel file.
-- The signed bot interaction and a fresh Discord role read enforce this permission.
-- This private RPC is still executable only by service_role. No existing data changes.
create or replace function public.police_nie_step(p_user text,p_operation uuid,p_step integer,p_answers jsonb,p_username text)
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
 values(d.id,p_user,left(coalesce(p_username,p_user),100),v_payload->>'full_name',v_payload->>'current_rank',coalesce(person.full_name,v_payload->>'full_name'),coalesce(person.plate,''),coalesce(person.rank_name,v_payload->>'current_rank'),v_payload);
 update public.police_nie_drafts set payload='{}'::jsonb,consumed_at=stamp,application_id=d.id where id=d.id;
 return jsonb_build_object('ok',true,'submitted',true,'reference',d.id);
end;
$$;
revoke all on function public.police_nie_step(text,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.police_nie_step(text,uuid,integer,jsonb,text) to service_role;
