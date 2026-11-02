-- Internal workflow metadata only. No task or alert executes a personnel decision.
create table public.police_administrative_tasks (
 id uuid primary key, title text not null check(length(trim(title)) between 3 and 160),
 description text not null default '' check(length(description)<=2000),
 status text not null default 'pending' check(status in ('pending','in_progress','completed','cancelled')),
 priority text not null default 'normal' check(priority in ('normal','high','urgent')),
 due_date date, assigned_to text check(assigned_to ~ '^[0-9]{17,20}$'), assigned_name text not null default '',
 target_id text check(target_id ~ '^[0-9]{17,20}$'),
 created_by text not null,created_by_name text not null,updated_by text not null,updated_by_name text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,
 version integer not null default 1 check(version>0)
);
create index police_tasks_status_date on public.police_administrative_tasks(status,due_date,created_at desc,id);
create index police_tasks_assigned_status on public.police_administrative_tasks(assigned_to,status,created_at desc);
create table public.police_administrative_task_versions (
 task_id uuid not null,version integer not null,before_state jsonb,after_state jsonb not null,
 actor_id text not null,actor_name text not null,created_at timestamptz not null default now(),primary key(task_id,version)
);
alter table public.police_administrative_tasks enable row level security;
alter table public.police_administrative_task_versions enable row level security;
revoke all on public.police_administrative_tasks,public.police_administrative_task_versions from public,anon,authenticated;
grant select,insert,update on public.police_administrative_tasks to service_role;
grant select,insert on public.police_administrative_task_versions to service_role;

create function public.save_police_administrative_task(p_id uuid,p_expected integer,p_data jsonb,p_actor text,p_actor_name text,p_director boolean,p_assigned_name text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare entry public.police_administrative_tasks; old_state jsonb; v_title text:=trim(p_data->>'title');v_description text:=coalesce(p_data->>'description','');
 v_status text:=p_data->>'status';v_priority text:=p_data->>'priority';v_assigned text:=nullif(p_data->>'assigned_to','');v_target text:=nullif(p_data->>'target_id','');v_due date:=nullif(p_data->>'due_date','')::date;
begin
 if p_id is null or p_actor is null or p_actor !~ '^[0-9]{17,20}$' or coalesce(length(v_title),0) not between 3 and 160 or length(v_description)>2000 or v_status is null or v_status not in ('pending','in_progress','completed','cancelled') or v_priority is null or v_priority not in ('normal','high','urgent') or (v_assigned is not null and v_assigned !~ '^[0-9]{17,20}$') or (v_target is not null and v_target !~ '^[0-9]{17,20}$') then return jsonb_build_object('ok',false,'error','Revisa los datos de la tarea.');end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-task:'||p_id::text,0));
 select * into entry from public.police_administrative_tasks where id=p_id for update;
 if found then
  if not coalesce(p_director,false) and entry.created_by<>p_actor and entry.assigned_to is distinct from p_actor then return jsonb_build_object('ok',false,'error','Solo Directiva, el creador o el responsable pueden modificar esta tarea.');end if;
  if not coalesce(p_director,false) and v_assigned is distinct from entry.assigned_to then return jsonb_build_object('ok',false,'error','Solo Directiva puede reasignar tareas.');end if;
  if p_expected is distinct from entry.version then
   if entry.updated_by=p_actor and entry.version=p_expected+1 and entry.title=v_title and entry.description=v_description and entry.status=v_status and entry.priority=v_priority and entry.due_date is not distinct from v_due and entry.assigned_to is not distinct from v_assigned and entry.target_id is not distinct from v_target then return jsonb_build_object('ok',true,'existing',true,'task',to_jsonb(entry));end if;
   return jsonb_build_object('ok',false,'error','La tarea cambió. Actualiza antes de guardar.');
  end if;
  old_state=to_jsonb(entry);
  update public.police_administrative_tasks set title=v_title,description=v_description,status=v_status,priority=v_priority,due_date=v_due,assigned_to=v_assigned,assigned_name=coalesce(p_assigned_name,''),target_id=v_target,updated_by=p_actor,updated_by_name=p_actor_name,updated_at=now(),version=version+1,completed_at=case when v_status='completed' then coalesce(completed_at,now()) else null end where id=p_id returning * into entry;
 else
  if p_expected is distinct from 0 then return jsonb_build_object('ok',false,'error','La tarea ya no existe.');end if;
  if not coalesce(p_director,false) and v_assigned is distinct from p_actor then return jsonb_build_object('ok',false,'error','Puedes crear tareas para ti. Directiva puede asignarlas a otros gestores.');end if;
  insert into public.police_administrative_tasks(id,title,description,status,priority,due_date,assigned_to,assigned_name,target_id,created_by,created_by_name,updated_by,updated_by_name,completed_at)
   values(p_id,v_title,v_description,v_status,v_priority,v_due,v_assigned,coalesce(p_assigned_name,''),v_target,p_actor,p_actor_name,p_actor,p_actor_name,case when v_status='completed' then now() end) returning * into entry;
 end if;
 insert into public.police_administrative_task_versions(task_id,version,before_state,after_state,actor_id,actor_name) values(p_id,entry.version,old_state,to_jsonb(entry),p_actor,p_actor_name);
 insert into public.police_audit_events(action,fields) values(case when old_state is null then 'Tarea administrativa creada' else 'Tarea administrativa actualizada' end,jsonb_build_array(jsonb_build_object('name','Gestor','value',p_actor_name),jsonb_build_object('name','Tarea','value',p_id),jsonb_build_object('name','Estado','value',v_status)));
 return jsonb_build_object('ok',true,'task',to_jsonb(entry));
end $$;
revoke all on function public.save_police_administrative_task(uuid,integer,jsonb,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.save_police_administrative_task(uuid,integer,jsonb,text,text,boolean,text) to service_role;

create function public.police_administrative_task_list(p_actor text,p_director boolean,p_scope text,p_status text,p_search text,p_offset integer) returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with filtered as(select * from public.police_administrative_tasks where (p_scope<>'mine' or assigned_to=p_actor) and (p_status='' or (p_status='open' and status in ('pending','in_progress')) or status=p_status) and (p_search='' or title ilike '%'||p_search||'%' or assigned_name ilike '%'||p_search||'%')),
 page as(select *,coalesce(p_director,false) or created_by=p_actor or assigned_to=p_actor as can_edit from filtered order by case priority when 'urgent' then 0 when 'high' then 1 else 2 end,due_date nulls last,created_at desc,id limit 25 offset greatest(0,p_offset))
 select jsonb_build_object('tasks',coalesce((select jsonb_agg(t) from page t),'[]'::jsonb),'total',(select count(*) from filtered),'next_offset',case when p_offset+25<(select count(*) from filtered) then p_offset+25 end);
$$;
revoke all on function public.police_administrative_task_list(text,boolean,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.police_administrative_task_list(text,boolean,text,text,text,integer) to service_role;

create view public.police_administrative_alerts with(security_invoker=true) as
 select 'absence:'||a.id as key,'absence'::text kind,'normal'::text severity,a.full_name as title,'Ausencia finaliza el '||to_char(a.end_date,'DD/MM/YYYY') as detail,a.discord_user_id as target_id,'personnel'::text destination,null::text actor_scope,a.created_at as occurred_at
 from public.police_absence_requests a join public.police_personnel p using(discord_user_id)
 where a.status='approved' and p.status='active' and a.start_date<=(now() at time zone 'Europe/Paris')::date and a.end_date between (now() at time zone 'Europe/Paris')::date and (now() at time zone 'Europe/Paris')::date+3
 union all
 select 'profile:'||p.discord_user_id,'profile','high',coalesce(nullif(p.full_name,''),p.discord_username,p.discord_user_id),'Revisar: '||concat_ws(', ',case when trim(p.full_name)='' then 'nombre IC' end,case when trim(p.plate)='' then 'placa' end,case when coalesce(trim(p.name_ooc),'')='' then 'nombre OOC' end,case when p.rank_role_id is null or trim(p.rank_name)='' then 'rango' end,case when p.last_rank_change_at is null then 'fecha del rango' end),p.discord_user_id,'personnel',null,p.updated_at
 from public.police_personnel p where p.status='active' and (trim(p.full_name)='' or trim(p.plate)='' or coalesce(trim(p.name_ooc),'')='' or p.rank_role_id is null or trim(p.rank_name)='' or p.last_rank_change_at is null)
 union all
 select 'discord:'||j.id,'discord',case when j.status='failed' then 'high' else 'normal' end,case j.kind when 'promotion' then 'Aviso de ascenso' when 'departure' then 'Aviso de baja' else 'Resultado por privado' end,'El aviso necesita revisión en Sincronización de Discord.',null,'sync',null,j.created_at from public.police_discord_jobs j where j.status='failed' or (j.status in ('pending','processing') and j.created_at<now()-interval '15 minutes')
 union all
 select 'task:'||t.id,'task','high',t.title,'Tarea vencida el '||to_char(t.due_date,'DD/MM/YYYY')||' · '||coalesce(nullif(t.assigned_name,''),'Sin responsable'),t.target_id,'tasks',null,t.created_at from public.police_administrative_tasks t where t.status in ('pending','in_progress') and t.due_date<(now() at time zone 'Europe/Paris')::date
 union all
 select 'approval:'||r.id,'approval','normal',coalesce(nullif(r.payload->>'full_name',''),nullif(r.before_state#>>'{record,full_name}',''),'Propuesta pendiente'),'Lleva más de 48 horas esperando revisión de Directiva.',null,'dashboard',r.requested_by,r.requested_at from public.police_change_requests r where r.status='pending' and r.requested_at<now()-interval '48 hours'
 union all
 select 'shift:'||s.id,'shift','normal',s.full_name,'Bitácora abierta durante más de 24 horas. Revisa la entrada y la salida.',s.discord_user_id,'shifts',null,s.started_at from public.police_duty_shifts s join public.police_personnel p using(discord_user_id) where s.ended_at is null and s.started_at<now()-interval '24 hours' and p.status='active';
revoke all on public.police_administrative_alerts from public,anon,authenticated;
grant select on public.police_administrative_alerts to service_role;

create function public.police_administrative_overview(p_actor text,p_director boolean,p_offset integer default 0,p_kind text default '') returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with visible as(select * from public.police_administrative_alerts where (actor_scope is null or coalesce(p_director,false) or actor_scope=p_actor)),
 filtered as(select * from visible where p_kind='' or kind=p_kind),
 page as(select * from filtered order by case severity when 'high' then 0 else 1 end,occurred_at,key limit 25 offset greatest(0,p_offset))
 select jsonb_build_object('generated_at',now(),'alert_total',(select count(*) from visible),'total',(select count(*) from filtered),'alerts',coalesce((select jsonb_agg(t) from page t),'[]'::jsonb),'next_offset',case when p_offset+25<(select count(*) from filtered) then p_offset+25 end,
 'tasks',jsonb_build_object('open',(select count(*) from public.police_administrative_tasks where status in ('pending','in_progress')),'mine',(select count(*) from public.police_administrative_tasks where status in ('pending','in_progress') and assigned_to=p_actor),'overdue',(select count(*) from public.police_administrative_tasks where status in ('pending','in_progress') and due_date<(now() at time zone 'Europe/Paris')::date)));
$$;
revoke all on function public.police_administrative_overview(text,boolean,integer,text) from public,anon,authenticated;
grant execute on function public.police_administrative_overview(text,boolean,integer,text) to service_role;

create view public.police_personnel_dossier_events with(security_invoker=true) as
 select 'rank:'||id as event_key,discord_user_id,'rank'::text kind,action_type as action,new_rank_name as title,concat_ws(' → ',nullif(previous_rank_name,''),new_rank_name)||E'\n'||reason as detail,changed_by_name as actor,created_at as occurred_at from public.police_rank_history
 union all select 'note:'||v.note_id||':'||v.version,n.discord_user_id,'note',case when v.archived_at is not null then 'archived' when v.version=1 then 'created' else 'edited' end,'Observación interna · versión '||v.version,v.content,v.changed_by_name,v.changed_at from public.police_personnel_note_versions v join public.police_personnel_notes n on n.id=v.note_id
 union all select 'absence:'||id,discord_user_id,'absence',status,'Ausencia / licencia',to_char(start_date,'DD/MM/YYYY')||' – '||to_char(end_date,'DD/MM/YYYY')||E'\n'||reason,coalesce(reviewed_by,'Responsable no registrado'),created_at from public.police_absence_requests
 union all select 'sanction:'||id,discord_user_id,'sanction',case when active and status='active' then 'active' else status end,case action_type when 'strike' then 'Strike' else 'Amonestación' end||' · nivel '||level,reason,issuer_name,created_at from public.police_sanctions
 union all select 'movement:'||id,discord_user_id,'movement',kind,case kind when 'departure' then 'Baja de personal' else 'Reingreso' end,'Fecha efectiva: '||to_char(effective_date,'DD/MM/YYYY')||E'\n'||reason,actor_name,created_at from public.police_personnel_movements
 union all select 'service:'||id,discord_user_id,'service',case when ended_at is null then 'open' else 'closed' end,'Bitácora de servicio','Entrada: '||to_char(started_at at time zone 'Europe/Paris','DD/MM/YYYY HH24:MI')||coalesce(E'\nSalida: '||to_char(ended_at at time zone 'Europe/Paris','DD/MM/YYYY HH24:MI'),E'\nEn servicio'),'Registro de servicio',started_at from public.police_duty_shifts
 union all select 'registration:'||discord_user_id,discord_user_id,'registration','created','Ficha registrada','Creación de la ficha de personal. Los movimientos anteriores no documentados pueden no aparecer.','Registro de personal',created_at from public.police_personnel;
revoke all on public.police_personnel_dossier_events from public,anon,authenticated;
grant select on public.police_personnel_dossier_events to service_role;
create function public.police_personnel_dossier(p_user text,p_kind text default '',p_offset integer default 0) returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with events as(select * from public.police_personnel_dossier_events where discord_user_id=p_user),filtered as(select * from events where p_kind='' or kind=p_kind),page as(select * from filtered order by occurred_at desc,event_key desc limit 25 offset greatest(0,p_offset))
 select jsonb_build_object('total',(select count(*) from filtered),'counts',coalesce((select jsonb_object_agg(kind,n) from(select kind,count(*) n from events group by kind)t),'{}'::jsonb),'events',coalesce((select jsonb_agg(t) from page t),'[]'::jsonb),'next_offset',case when p_offset+25<(select count(*) from filtered) then p_offset+25 end);
$$;
revoke all on function public.police_personnel_dossier(text,text,integer) from public,anon,authenticated;
grant execute on function public.police_personnel_dossier(text,text,integer) to service_role;
