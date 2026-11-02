create table public.police_discord_jobs (
 id uuid primary key default gen_random_uuid(),event_key text not null unique,
 kind text not null check(kind in ('promotion','departure','dm')),payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','superseded')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
 lease uuid,locked_until timestamptz,last_error text,created_at timestamptz not null default now(),sent_at timestamptz
);
create index police_discord_jobs_due on public.police_discord_jobs(next_attempt_at,created_at) where status in ('pending','processing');
create index police_discord_jobs_recent on public.police_discord_jobs(created_at desc,id desc);
alter table public.police_discord_jobs enable row level security;
revoke all on public.police_discord_jobs from public,anon,authenticated;
grant select,insert,update on public.police_discord_jobs to service_role;
create function public.claim_police_discord_job(p_id uuid default null) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare job public.police_discord_jobs;
begin
 select * into job from public.police_discord_jobs where (p_id is null or id=p_id)
  and ((status='pending' and next_attempt_at<=now()) or (status='processing' and locked_until<now()))
  order by next_attempt_at,created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.police_discord_jobs set status='processing',attempts=attempts+1,lease=gen_random_uuid(),locked_until=now()+interval '2 minutes' where id=job.id returning * into job;
 return to_jsonb(job);
end $$;
revoke all on function public.claim_police_discord_job(uuid) from public,anon,authenticated;
grant execute on function public.claim_police_discord_job(uuid) to service_role;

create function public.police_workspace_summary(p_actor text,p_director boolean) returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with requests as(select * from public.police_change_requests where status in ('pending','processing') and (p_director or requested_by=p_actor) order by requested_at desc,id desc limit 26)
 select jsonb_build_object(
  'availability',public.police_absence_summary()-'current',
  'working',(select count(*) from public.police_duty_shifts s join public.police_personnel p using(discord_user_id) where s.ended_at is null and p.status='active'),
  'shifts',coalesce((select jsonb_agg(t) from(select full_name,plate,unit,started_at,ended_at from public.police_duty_shifts order by started_at desc,id desc limit 5)t),'[]'::jsonb),
  'applications',(select count(*) from public.police_available_applications where status='pending'),
  'intakes',(select count(*) from public.police_rank_requests where status='pending'),
  'transfers',(select count(*) from public.police_transfer_applications where status='pending'),
  'events',coalesce((select jsonb_agg(t) from(select action,fields,created_at from public.police_audit_events order by created_at desc,id desc limit 5)t),'[]'::jsonb),
  'inbox',jsonb_build_object('can_approve',p_director,'requests',coalesce((select jsonb_agg(t) from(select * from requests limit 25)t),'[]'::jsonb),'next_offset',case when(select count(*) from requests)>25 then 25 end),
  'legacy',jsonb_build_object('authorizations',coalesce((select jsonb_agg(t) from(select * from public.police_rank_authorizations where status in ('pending','processing') and (p_director or requested_by=p_actor) order by requested_at desc limit 50)t),'[]'::jsonb)),
  'sync',jsonb_build_object('pending',(select count(*) from public.police_discord_jobs where status in ('pending','processing')),'failed',(select count(*) from public.police_discord_jobs where status='failed')),
  'generated_at',now()
 );
$$;
revoke all on function public.police_workspace_summary(text,boolean) from public,anon,authenticated;
grant execute on function public.police_workspace_summary(text,boolean) to service_role;
