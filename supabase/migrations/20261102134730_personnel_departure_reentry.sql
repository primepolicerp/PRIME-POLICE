alter table public.police_personnel
 add column departure_type text,
 add column departure_date date,
 add column departure_reason text,
 add column departure_by_name text,
 add column reentry_count integer not null default 0 check(reentry_count>=0);

create table public.police_personnel_movements (
 id uuid primary key,
 discord_user_id text not null,
 kind text not null check(kind in ('departure','reentry')),
 departure_type text,
 effective_date date not null,
 reason text not null check(length(reason) between 3 and 2000),
 actor_id text not null,
 actor_name text not null,
 previous_rank_name text not null default '',
 new_rank_name text not null default '',
 unit text not null,
 created_at timestamptz not null default now()
);
create index police_personnel_movements_person_date on public.police_personnel_movements(discord_user_id,created_at desc,id desc);
alter table public.police_personnel_movements enable row level security;
revoke all on public.police_personnel_movements from public,anon,authenticated;
grant select,insert on public.police_personnel_movements to service_role;

create function public.change_police_personnel_status(
 p_operation uuid,p_user text,p_kind text,p_type text,p_date date,p_reason text,
 p_actor text,p_actor_name text,p_expected_updated_at timestamptz,p_rank_id text,p_rank_name text,p_unit text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_person public.police_personnel; v_event public.police_personnel_movements;
begin
 select * into v_person from public.police_personnel where discord_user_id=p_user for update;
 if not found then return jsonb_build_object('ok',false,'error','La ficha ya no existe.'); end if;
 select * into v_event from public.police_personnel_movements where id=p_operation;
 if found then
  if v_event.discord_user_id=p_user and v_event.kind=p_kind and v_event.actor_id=p_actor then
   return jsonb_build_object('ok',true,'person',to_jsonb(v_person),'movement',to_jsonb(v_event),'replayed',true);
  end if;
  return jsonb_build_object('ok',false,'error','Esta operación ya corresponde a otro movimiento.');
 end if;
 if v_person.updated_at is distinct from p_expected_updated_at then return jsonb_build_object('ok',false,'error','La ficha cambió. Actualiza Personal antes de continuar.'); end if;
 if p_kind not in ('departure','reentry') or p_kind is null or p_date is null or p_date>current_date+1
  or length(trim(coalesce(p_reason,''))) not between 3 and 2000 or p_actor !~ '^[0-9]{17,20}$'
  or length(trim(coalesce(p_actor_name,'')))=0 then raise exception 'Datos del movimiento inválidos'; end if;
 if p_kind='departure' then
  if v_person.status<>'active' then return jsonb_build_object('ok',false,'error','El agente ya está de baja.'); end if;
  if p_type is null or p_type not in ('pkt','ck','despido','corrupcion','renuncia','jubilacion','transferencia','inactividad','otro') then raise exception 'Motivo de baja inválido'; end if;
  update public.police_personnel set status='inactive',departure_type=p_type,departure_date=p_date,
   departure_reason=trim(p_reason),departure_by_name=p_actor_name,updated_at=clock_timestamp() where discord_user_id=p_user;
  update public.police_duty_shifts set ended_at=greatest(started_at,now()),closed_by=p_actor,
   close_reason='Baja de Personal: '||p_type where discord_user_id=p_user and ended_at is null;
 else
  if v_person.status<>'inactive' then return jsonb_build_object('ok',false,'error','El agente ya está activo.'); end if;
  if p_unit is null or p_unit not in ('POLICIA','UCOP','CIC') or p_rank_id is null or p_rank_name is null
   or not exists(select 1 from public.police_rank_roles where role_id=p_rank_id) then raise exception 'Rango o división inválidos'; end if;
  if v_person.departure_date is not null and p_date<v_person.departure_date then raise exception 'El reingreso no puede ser anterior a la baja'; end if;
  update public.police_personnel set status='active',rank_role_id=p_rank_id,rank_name=p_rank_name,unit=p_unit,
   reentry_count=reentry_count+1,last_rank_change_at=clock_timestamp(),updated_at=clock_timestamp() where discord_user_id=p_user;
 end if;
 insert into public.police_personnel_movements(id,discord_user_id,kind,departure_type,effective_date,reason,actor_id,actor_name,previous_rank_name,new_rank_name,unit)
 values(p_operation,p_user,p_kind,case when p_kind='departure' then p_type end,p_date,trim(p_reason),p_actor,p_actor_name,
  v_person.rank_name,case when p_kind='reentry' then p_rank_name else '' end,case when p_kind='reentry' then p_unit else v_person.unit end)
 returning * into v_event;
 select * into v_person from public.police_personnel where discord_user_id=p_user;
 return jsonb_build_object('ok',true,'person',to_jsonb(v_person),'movement',to_jsonb(v_event));
end $$;
revoke all on function public.change_police_personnel_status(uuid,text,text,text,date,text,text,text,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.change_police_personnel_status(uuid,text,text,text,date,text,text,text,timestamptz,text,text,text) to service_role;
