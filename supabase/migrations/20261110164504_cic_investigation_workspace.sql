create table public.police_cic_cases(
 id uuid primary key default gen_random_uuid(),number bigint generated always as identity unique,
 kind text not null check(kind in ('band','person','point','request','bracelet')),
 title text not null check(length(trim(title)) between 3 and 120),
 summary text not null default '' check(length(summary)<=6000),
 next_action text not null default '' check(length(next_action)<=2000),
 location text not null default '' check(length(location)<=200),
 assignee_name text not null check(length(trim(assignee_name)) between 3 and 120),
 status text not null default 'open' check(status in ('open','review','closed')),
 created_by text not null check(created_by ~ '^[0-9]{17,20}$'),updated_by text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 version integer not null default 1 check(version>0)
);
create index police_cic_cases_list on public.police_cic_cases(kind,status,updated_at desc,id);
create table public.police_cic_entries(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.police_cic_cases(id),
 kind text not null check(kind in ('person','point','vehicle','evidence','note')),
 title text not null check(length(trim(title)) between 3 and 200),
 details text not null default '' check(length(details)<=6000),
 certainty text not null default 'pending' check(certainty in ('pending','observed','confirmed')),
 source_url text not null default '' check(length(source_url)<=500),
 created_by text not null check(created_by ~ '^[0-9]{17,20}$'),author_name text not null,
 created_at timestamptz not null default now()
);
create index police_cic_entries_case on public.police_cic_entries(case_id,kind,created_at desc,id);
create table public.police_cic_events(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.police_cic_cases(id),
 action text not null,actor_id text not null,actor_name text not null,
 changes jsonb not null,created_at timestamptz not null default now()
);
create index police_cic_events_case on public.police_cic_events(case_id,created_at desc,id);
alter table public.police_cic_cases enable row level security;
alter table public.police_cic_entries enable row level security;
alter table public.police_cic_events enable row level security;
revoke all on public.police_cic_cases,public.police_cic_entries,public.police_cic_events from public,anon,authenticated;
grant select,insert,update on public.police_cic_cases to service_role;
grant select,insert on public.police_cic_entries,public.police_cic_events to service_role;
grant usage,select on sequence public.police_cic_cases_number_seq to service_role;

create function public.police_cic_write(p_action text,p_payload jsonb,p_actor text,p_name text,p_director boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.police_cic_cases; added uuid;
begin
 if p_actor is null or p_actor !~ '^[0-9]{17,20}$' or coalesce(length(trim(p_name)),0) not between 1 and 200
 or p_action is null or p_action not in ('create','edit','entry','review','close','reopen') then raise exception 'Invalid CIC operation' using errcode='22023';end if;
 if p_action='create' then
  insert into public.police_cic_cases(kind,title,summary,next_action,location,assignee_name,created_by,updated_by)
  values(p_payload->>'kind',trim(p_payload->>'title'),coalesce(p_payload->>'summary',''),coalesce(p_payload->>'next_action',''),coalesce(p_payload->>'location',''),trim(p_payload->>'assignee_name'),p_actor,p_actor) returning * into c;
 else
  select * into c from public.police_cic_cases where id=(p_payload->>'id')::uuid for update;
  if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
  if c.version is distinct from (p_payload->>'version')::integer then return jsonb_build_object('ok',false,'code','conflict');end if;
  if p_action in ('close','reopen') and p_director is distinct from true then return jsonb_build_object('ok',false,'code','forbidden');end if;
  if c.status='closed' and p_action<>'reopen' then return jsonb_build_object('ok',false,'code','closed');end if;
  if p_action='reopen' and c.status<>'closed' then return jsonb_build_object('ok',false,'code','invalid_state');end if;
  if p_action='entry' then
   if p_payload->>'kind'='evidence' and coalesce(p_payload->>'source_url','') !~ '^https://(canary\.|ptb\.)?discord(app)?\.com/channels/1539970134469378068/[0-9]{17,20}/[0-9]{17,20}$' then raise exception 'Evidence needs a Discord message' using errcode='22023';end if;
   insert into public.police_cic_entries(case_id,kind,title,details,certainty,source_url,created_by,author_name)
   values(c.id,p_payload->>'kind',trim(p_payload->>'title'),coalesce(p_payload->>'details',''),coalesce(p_payload->>'certainty','pending'),coalesce(p_payload->>'source_url',''),p_actor,p_name) returning id into added;
  end if;
  update public.police_cic_cases set
   title=case when p_action='edit' then trim(p_payload->>'title') else title end,
   summary=case when p_action='edit' then coalesce(p_payload->>'summary','') else summary end,
   next_action=case when p_action='edit' then coalesce(p_payload->>'next_action','') else next_action end,
   location=case when p_action='edit' then coalesce(p_payload->>'location','') else location end,
   assignee_name=case when p_action='edit' then trim(p_payload->>'assignee_name') else assignee_name end,
   status=case when p_action='review' then 'review' when p_action='close' then 'closed' when p_action='reopen' then 'open' else status end,
   updated_by=p_actor,updated_at=now(),version=version+1 where id=c.id returning * into c;
 end if;
 insert into public.police_cic_events(case_id,action,actor_id,actor_name,changes) values(c.id,p_action,p_actor,p_name,p_payload);
 return jsonb_build_object('ok',true,'case',to_jsonb(c),'entry_id',added);
end;$$;
revoke all on function public.police_cic_write(text,jsonb,text,text,boolean) from public,anon,authenticated;
grant execute on function public.police_cic_write(text,jsonb,text,text,boolean) to service_role;

create function public.police_cic_read(p_kind text default 'band',p_status text default '',p_search text default '',p_id uuid default null,p_entry_kind text default 'note',p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare rows jsonb; total bigint;case_row public.police_cic_cases; counts jsonb;
begin
 if p_offset is null or p_offset<0 or p_offset>100000 or p_kind is null or p_kind not in ('band','person','point','request','bracelet') or p_status is null or p_status not in ('','open','review','closed') or p_search is null or length(p_search)>100 or p_entry_kind is null or p_entry_kind not in ('note','person','point','vehicle','evidence','activity') then raise exception 'Invalid CIC filters' using errcode='22023';end if;
 if p_id is null then
  select count(*) into total from public.police_cic_cases c where c.kind=p_kind and (p_status='' or c.status=p_status) and (p_search='' or strpos(lower(c.title||' '||c.location||' '||c.assignee_name||' '||c.summary),lower(p_search))>0 or exists(select 1 from public.police_cic_entries e where e.case_id=c.id and strpos(lower(e.title||' '||e.details),lower(p_search))>0));
  select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc,r.id),'[]'::jsonb) into rows from (select c.id,c.number,c.kind,c.title,c.status,c.assignee_name,c.location,c.updated_at,c.version from public.police_cic_cases c where c.kind=p_kind and (p_status='' or c.status=p_status) and (p_search='' or strpos(lower(c.title||' '||c.location||' '||c.assignee_name||' '||c.summary),lower(p_search))>0 or exists(select 1 from public.police_cic_entries e where e.case_id=c.id and strpos(lower(e.title||' '||e.details),lower(p_search))>0)) order by c.updated_at desc,c.id limit 50 offset p_offset)r;
  return jsonb_build_object('ok',true,'records',rows,'total',total,'next_offset',case when p_offset+50<total then p_offset+50 end);
 end if;
 select * into case_row from public.police_cic_cases where id=p_id;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 select coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) into counts from (select kind,count(*) n from public.police_cic_entries where case_id=p_id group by kind)x;
 if p_entry_kind='activity' then
  select count(*) into total from public.police_cic_events where case_id=p_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb) into rows from (select id,action,actor_name,created_at from public.police_cic_events where case_id=p_id order by created_at desc,id limit 50 offset p_offset)r;
 else
  select count(*) into total from public.police_cic_entries where case_id=p_id and kind=p_entry_kind;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb) into rows from (select * from public.police_cic_entries where case_id=p_id and kind=p_entry_kind order by created_at desc,id limit 50 offset p_offset)r;
 end if;
 return jsonb_build_object('ok',true,'case',to_jsonb(case_row),'counts',counts,'records',rows,'total',total,'next_offset',case when p_offset+50<total then p_offset+50 end);
end;$$;
revoke all on function public.police_cic_read(text,text,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.police_cic_read(text,text,text,uuid,text,integer) to service_role;
