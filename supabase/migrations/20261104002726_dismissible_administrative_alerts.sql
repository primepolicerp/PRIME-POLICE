create table public.police_administrative_alert_dismissals (
 actor_id text not null check(actor_id ~ '^[0-9]{17,20}$'),
 alert_key text not null check(length(alert_key) between 1 and 100),
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{32}$'),
 actor_name text not null,ignored_at timestamptz not null default now(),
 primary key(actor_id,alert_key)
);
alter table public.police_administrative_alert_dismissals enable row level security;
revoke all on public.police_administrative_alert_dismissals from public,anon,authenticated;
grant select,insert,update,delete on public.police_administrative_alert_dismissals to service_role;

create function public.police_administrative_alert_list(p_actor text,p_director boolean,p_offset integer default 0,p_kind text default '',p_ignored boolean default false)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with visible as (
  select a.*,md5(to_jsonb(a)::text) as fingerprint,
   d.fingerprint=md5(to_jsonb(a)::text) as was_ignored,d.ignored_at
  from public.police_administrative_alerts a
  left join public.police_administrative_alert_dismissals d on d.actor_id=p_actor and d.alert_key=a.key
  where a.actor_scope is null or coalesce(p_director,false) or a.actor_scope=p_actor
 ),classified as (select *,coalesce(was_ignored,false) as ignored from visible),
 filtered as(select * from classified where ignored=p_ignored and (p_kind='' or kind=p_kind)),
 page as(select * from filtered order by case severity when 'high' then 0 else 1 end,occurred_at,key limit 25 offset greatest(0,p_offset))
 select jsonb_build_object('generated_at',now(),'alert_total',(select count(*) from classified where not ignored),'ignored_total',(select count(*) from classified where ignored),
 'total',(select count(*) from filtered),'alerts',coalesce((select jsonb_agg(to_jsonb(t)-'was_ignored' order by case severity when 'high' then 0 else 1 end,occurred_at,key) from page t),'[]'::jsonb),
 'next_offset',case when p_offset+25<(select count(*) from filtered) then p_offset+25 end,
 'tasks',jsonb_build_object('open',(select count(*) from public.police_administrative_tasks where status in ('pending','in_progress')),
 'mine',(select count(*) from public.police_administrative_tasks where status in ('pending','in_progress') and assigned_to=p_actor),
 'overdue',(select count(*) from public.police_administrative_tasks where status in ('pending','in_progress') and due_date<(now() at time zone 'Europe/Paris')::date)));
$$;
revoke all on function public.police_administrative_alert_list(text,boolean,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.police_administrative_alert_list(text,boolean,integer,text,boolean) to service_role;

-- Keep dashboard and older clients consistent with the active list.
create or replace function public.police_administrative_overview(p_actor text,p_director boolean,p_offset integer default 0,p_kind text default '')
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select public.police_administrative_alert_list(p_actor,p_director,p_offset,p_kind,false);
$$;

create function public.set_police_administrative_alert_ignored(p_actor text,p_actor_name text,p_director boolean,p_key text,p_fingerprint text,p_ignore boolean)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_fingerprint text;
begin
 if p_actor is null or p_actor!~'^[0-9]{17,20}$' or p_key is null or length(p_key) not between 1 and 100 or p_fingerprint is null or p_fingerprint!~'^[0-9a-f]{32}$' or p_ignore is null then
  return jsonb_build_object('ok',false,'error','Alerta inválida.');end if;
 select md5(to_jsonb(a)::text) into current_fingerprint from public.police_administrative_alerts a
 where a.key=p_key and (a.actor_scope is null or coalesce(p_director,false) or a.actor_scope=p_actor);
 if current_fingerprint is null then return jsonb_build_object('ok',false,'error','La alerta ya no está activa o no está disponible para tu cuenta.');end if;
 if current_fingerprint<>p_fingerprint then return jsonb_build_object('ok',false,'error','La alerta cambió. Actualiza la lista antes de ignorarla o restaurarla.');end if;
 if p_ignore then
  insert into public.police_administrative_alert_dismissals(actor_id,alert_key,fingerprint,actor_name)
  values(p_actor,p_key,p_fingerprint,left(coalesce(p_actor_name,p_actor),200))
  on conflict(actor_id,alert_key) do update set fingerprint=excluded.fingerprint,actor_name=excluded.actor_name,ignored_at=now();
 else
  delete from public.police_administrative_alert_dismissals where actor_id=p_actor and alert_key=p_key and fingerprint=p_fingerprint;
 end if;
 return jsonb_build_object('ok',true,'ignored',p_ignore);
end $$;
revoke all on function public.set_police_administrative_alert_ignored(text,text,boolean,text,text,boolean) from public,anon,authenticated;
grant execute on function public.set_police_administrative_alert_ignored(text,text,boolean,text,text,boolean) to service_role;
