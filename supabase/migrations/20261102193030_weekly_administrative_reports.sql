alter table public.police_discord_jobs drop constraint police_discord_jobs_kind_check;
alter table public.police_discord_jobs add constraint police_discord_jobs_kind_check check(kind in ('promotion','departure','dm','weekly_report'));
alter table public.police_discord_jobs add column discord_message_id text;
create table public.police_weekly_reports_config (
 id boolean primary key default true check(id),enabled boolean not null default false,
 channel_id text not null check(channel_id='1539970136839163960'),timezone text not null default 'Europe/Paris' check(timezone='Europe/Paris'),
 updated_at timestamptz not null default now()
);
insert into public.police_weekly_reports_config(id,channel_id) values(true,'1539970136839163960');
alter table public.police_weekly_reports_config enable row level security;
revoke all on public.police_weekly_reports_config from public,anon,authenticated;
grant select,update on public.police_weekly_reports_config to service_role;

create function public.police_weekly_period(p_at timestamptz) returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('week_start',(monday-interval '7 days')::date,'week_end',monday::date,'from_utc',(monday-interval '7 days') at time zone 'Europe/Paris','to_utc',monday at time zone 'Europe/Paris','send_at',(monday+interval '9 hours') at time zone 'Europe/Paris') from(select date_trunc('week',p_at at time zone 'Europe/Paris') monday)t;
$$;
revoke all on function public.police_weekly_period(timestamptz) from public,anon,authenticated;
grant execute on function public.police_weekly_period(timestamptz) to service_role;

create function public.build_police_weekly_report(p_start date) returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare start_at timestamptz:=p_start::timestamp at time zone 'Europe/Paris';end_at timestamptz:=(p_start+7)::timestamp at time zone 'Europe/Paris';result jsonb;
begin
 if p_start is null or extract(isodow from p_start)<>1 or end_at>now() then raise exception 'Only complete Monday-to-Sunday weeks may be reported';end if;
 select jsonb_build_object(
  'eventId',p_start::text,'week_start',p_start,'week_end',p_start+7,'from_utc',start_at,'to_utc',end_at,'generated_at',now(),'channel_id','1539970136839163960','name','Semana '||to_char(p_start,'DD/MM/YYYY')||' – '||to_char(p_start+6,'DD/MM/YYYY'),
  'applications',(select jsonb_build_object('received',count(*) filter(where created_at>=start_at and created_at<end_at),'accepted',count(*) filter(where status='accepted' and reviewed_at>=start_at and reviewed_at<end_at),'rejected',count(*) filter(where status='rejected' and reviewed_at>=start_at and reviewed_at<end_at)) from public.police_applications),
  'transfers',(select jsonb_build_object('received',count(*) filter(where created_at>=start_at and created_at<end_at),'accepted',count(*) filter(where status='accepted' and reviewed_at>=start_at and reviewed_at<end_at),'rejected',count(*) filter(where status='rejected' and reviewed_at>=start_at and reviewed_at<end_at)) from public.police_transfer_applications),
  'intakes',(select jsonb_build_object('received',count(*) filter(where created_at>=start_at and created_at<end_at),'accepted',count(*) filter(where status='accepted' and reviewed_at>=start_at and reviewed_at<end_at),'rejected',count(*) filter(where status='rejected' and reviewed_at>=start_at and reviewed_at<end_at)) from public.police_rank_requests),
  'personnel',jsonb_build_object('new_files',(select count(*) from public.police_personnel where created_at>=start_at and created_at<end_at),'departures',(select count(*) from public.police_personnel_movements where kind='departure' and created_at>=start_at and created_at<end_at),'reentries',(select count(*) from public.police_personnel_movements where kind='reentry' and created_at>=start_at and created_at<end_at)),
  'ranks',(select jsonb_build_object('promotions',count(*) filter(where action_type='promotion'),'demotions',count(*) filter(where action_type='demotion'),'assignments',count(*) filter(where action_type='assignment')) from public.police_rank_history where created_at>=start_at and created_at<end_at),
  'service',(select jsonb_build_object('seconds',coalesce(sum(greatest(0,extract(epoch from least(coalesce(ended_at,end_at),end_at)-greatest(started_at,start_at)))) filter(where started_at<end_at and coalesce(ended_at,end_at)>start_at),0),'agents',count(distinct discord_user_id) filter(where started_at<end_at and coalesce(ended_at,end_at)>start_at),'started',count(*) filter(where started_at>=start_at and started_at<end_at),'closed',count(*) filter(where ended_at>=start_at and ended_at<end_at)) from public.police_duty_shifts),
  'service_by_unit',coalesce((select jsonb_object_agg(unit,seconds) from(select coalesce(unit,'POLICIA') unit,sum(greatest(0,extract(epoch from least(coalesce(ended_at,end_at),end_at)-greatest(started_at,start_at)))) seconds from public.police_duty_shifts where started_at<end_at and coalesce(ended_at,end_at)>start_at group by coalesce(unit,'POLICIA'))t),'{}'::jsonb),
  'absences',(select jsonb_build_object('registered',count(*) filter(where status='approved' and created_at>=start_at and created_at<end_at),'agents',count(distinct discord_user_id) filter(where status='approved' and created_at<end_at and start_date<p_start+7 and end_date>=p_start)) from public.police_absence_requests),
  'sanctions',(select jsonb_build_object('warnings',count(*) filter(where status='active' and action_type='warning'),'strikes',count(*) filter(where status='active' and action_type='strike'),'failed',count(*) filter(where status='failed')) from public.police_sanctions where created_at>=start_at and created_at<end_at),
  'notes',(select jsonb_build_object('added',count(*) filter(where version=1),'edited',count(*) filter(where version>1 and archived_at is null),'archived',count(*) filter(where archived_at is not null)) from public.police_personnel_note_versions where changed_at>=start_at and changed_at<end_at),
  'tasks',jsonb_build_object('created',(select count(*) from public.police_administrative_tasks where created_at>=start_at and created_at<end_at),'completed',(select count(distinct task_id) from public.police_administrative_task_versions where created_at>=start_at and created_at<end_at and after_state->>'status'='completed' and coalesce(before_state->>'status','')<>'completed')),
  'directiva',(select jsonb_build_object('approved',count(*) filter(where status='approved'),'discarded',count(*) filter(where status='rejected'),'failed',count(*) filter(where status='failed')) from public.police_change_requests where reviewed_at>=start_at and reviewed_at<end_at),
  'notifications',(select jsonb_build_object('sent',count(*) filter(where status='sent' and sent_at>=start_at and sent_at<end_at),'failed',count(*) filter(where status='failed' and created_at>=start_at and created_at<end_at)) from public.police_discord_jobs),
  'current',jsonb_build_object('active',(select count(*) from public.police_personnel where status='active'),'inactive',(select count(*) from public.police_personnel where status='inactive'),'open_shifts',(select count(*) from public.police_duty_shifts where ended_at is null),'applications',(select count(*) from public.police_available_applications where status='pending'),'transfers',(select count(*) from public.police_transfer_applications where status='pending'),'intakes',(select count(*) from public.police_rank_requests where status='pending'),'proposals',(select count(*) from public.police_change_requests where status in ('pending','processing')),'tasks',(select count(*) from public.police_administrative_tasks where status in ('pending','in_progress')),'notification_pending',(select count(*) from public.police_discord_jobs where status in ('pending','processing')),'notification_failed',(select count(*) from public.police_discord_jobs where status='failed'))
 ) into result;
 return result;
end $$;
revoke all on function public.build_police_weekly_report(date) from public,anon,authenticated;
grant execute on function public.build_police_weekly_report(date) to service_role;

create function public.enqueue_due_police_weekly_report() returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare config public.police_weekly_reports_config;period jsonb;job_id uuid;event text;
begin
 select * into config from public.police_weekly_reports_config where id;
 if not found or not config.enabled then return null;end if;
 period=public.police_weekly_period(now());if now()<(period->>'send_at')::timestamptz then return null;end if;
 event='weekly_report:'||(period->>'week_start');perform pg_advisory_xact_lock(hashtextextended(event,0));
 select id into job_id from public.police_discord_jobs where event_key=event;if found then return job_id;end if;
 insert into public.police_discord_jobs(event_key,kind,payload) values(event,'weekly_report',public.build_police_weekly_report((period->>'week_start')::date)) on conflict(event_key) do nothing returning id into job_id;
 return job_id;
end $$;
revoke all on function public.enqueue_due_police_weekly_report() from public,anon,authenticated;
grant execute on function public.enqueue_due_police_weekly_report() to service_role;

create or replace view public.police_administrative_alerts with(security_invoker=true) as
 select 'absence:'||a.id as key,'absence'::text kind,'normal'::text severity,a.full_name as title,'Ausencia finaliza el '||to_char(a.end_date,'DD/MM/YYYY') as detail,a.discord_user_id as target_id,'personnel'::text destination,null::text actor_scope,a.created_at as occurred_at
 from public.police_absence_requests a join public.police_personnel p using(discord_user_id)
 where a.status='approved' and p.status='active' and a.start_date<=(now() at time zone 'Europe/Paris')::date and a.end_date between (now() at time zone 'Europe/Paris')::date and (now() at time zone 'Europe/Paris')::date+3
 union all
 select 'profile:'||p.discord_user_id,'profile','high',coalesce(nullif(p.full_name,''),p.discord_username,p.discord_user_id),'Revisar: '||concat_ws(', ',case when trim(p.full_name)='' then 'nombre IC' end,case when trim(p.plate)='' then 'placa' end,case when coalesce(trim(p.name_ooc),'')='' then 'nombre OOC' end,case when p.rank_role_id is null or trim(p.rank_name)='' then 'rango' end,case when p.last_rank_change_at is null then 'fecha del rango' end),p.discord_user_id,'personnel',null,p.updated_at
 from public.police_personnel p where p.status='active' and (trim(p.full_name)='' or trim(p.plate)='' or coalesce(trim(p.name_ooc),'')='' or p.rank_role_id is null or trim(p.rank_name)='' or p.last_rank_change_at is null)
 union all
 select 'discord:'||j.id,'discord',case when j.status='failed' then 'high' else 'normal' end,case j.kind when 'promotion' then 'Aviso de ascenso' when 'departure' then 'Aviso de baja' when 'weekly_report' then 'Informe semanal' else 'Resultado por privado' end,'El aviso necesita revisión en Sincronización de Discord.',null,'sync',null,j.created_at from public.police_discord_jobs j where j.status='failed' or (j.status in ('pending','processing') and j.created_at<now()-interval '15 minutes')
 union all
 select 'task:'||t.id,'task','high',t.title,'Tarea vencida el '||to_char(t.due_date,'DD/MM/YYYY')||' · '||coalesce(nullif(t.assigned_name,''),'Sin responsable'),t.target_id,'tasks',null,t.created_at from public.police_administrative_tasks t where t.status in ('pending','in_progress') and t.due_date<(now() at time zone 'Europe/Paris')::date
 union all
 select 'approval:'||r.id,'approval','normal',coalesce(nullif(r.payload->>'full_name',''),nullif(r.before_state#>>'{record,full_name}',''),'Propuesta pendiente'),'Lleva más de 48 horas esperando revisión de Directiva.',null,'dashboard',r.requested_by,r.requested_at from public.police_change_requests r where r.status='pending' and r.requested_at<now()-interval '48 hours'
 union all
 select 'shift:'||s.id,'shift','normal',s.full_name,'Bitácora abierta durante más de 24 horas. Revisa la entrada y la salida.',s.discord_user_id,'shifts',null,s.started_at from public.police_duty_shifts s join public.police_personnel p using(discord_user_id) where s.ended_at is null and s.started_at<now()-interval '24 hours' and p.status='active';

revoke all on public.police_administrative_alerts from public,anon,authenticated;
grant select on public.police_administrative_alerts to service_role;
