-- Serialize initialization with the existing allocation path.
select pg_advisory_xact_lock(hashtextextended('police-plate-allocation',0));
create table public.police_plate_counter (
 id smallint primary key check(id=1),
 next_number numeric not null check(next_number>=116 and next_number=trunc(next_number)),
 updated_at timestamptz not null default now()
);
alter table public.police_plate_counter enable row level security;
revoke all on public.police_plate_counter from public,anon,authenticated;
grant select,update on public.police_plate_counter to service_role;

-- Continue at the first unused number in the original 0116 series. Preserve all
-- personnel and reservation records, including outliers and past allocations.
with used as (
 select plate_number n from public.police_personnel where plate_number>=116
 union select plate_number from public.police_plate_reservations where plate_number>=116
),candidates as(select 116::numeric n union select n+1 from used)
insert into public.police_plate_counter(id,next_number)
select 1,min(c.n) from candidates c where not exists(select 1 from used u where u.n=c.n);

create or replace function public.next_police_plate() returns text language sql security invoker set search_path=public,pg_temp as $$
 with position as(select next_number from public.police_plate_counter where id=1),
 used as (
  select plate_number n from public.police_personnel where plate_number>=(select next_number from position)
  union select plate_number from public.police_plate_reservations where plate_number>=(select next_number from position)
 ),candidates as(select next_number n from position union select n+1 from used),
 available as(select min(c.n) n from candidates c where not exists(select 1 from used u where u.n=c.n))
 select lpad(n::text,greatest(4,length(n::text)),'0') from available;
$$;
revoke all on function public.next_police_plate() from public,anon,authenticated;
grant execute on function public.next_police_plate() to service_role;

create or replace function public.reserve_police_plate(p_operation uuid,p_user text,p_manual text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare existing public.police_plate_reservations; candidate text; number numeric;
begin
 if p_operation is null or p_user is null or p_user !~ '^[0-9]{17,20}$' then return jsonb_build_object('ok',false,'error','No se pudo identificar el ingreso para asignar placa.');end if;
 if p_manual is not null and trim(p_manual) !~ '^[0-9]{1,30}$' then return jsonb_build_object('ok',false,'error','La placa debe contener solo números.');end if;
 perform pg_advisory_xact_lock(hashtextextended('police-plate-allocation',0));
 select * into existing from public.police_plate_reservations where operation_id=p_operation;
 if found then
  if existing.discord_user_id<>p_user then return jsonb_build_object('ok',false,'error','La referencia de placa pertenece a otro ingreso.');end if;
  if p_manual is not null and trim(p_manual)::numeric<>existing.plate_number then return jsonb_build_object('ok',false,'error','Este ingreso ya tiene una placa reservada. Revisa el resultado antes de cambiarla.');end if;
  return jsonb_build_object('ok',true,'plate',existing.plate);
 end if;
 if p_manual is null then candidate:=public.next_police_plate();
 else candidate:=lpad(trim(p_manual)::numeric::text,greatest(4,length(trim(p_manual)::numeric::text)),'0');end if;
 number:=candidate::numeric;
 if exists(select from public.police_personnel where plate_number=number and status='active' and discord_user_id<>p_user)
 or exists(select from public.police_plate_reservations where plate_number=number) then return jsonb_build_object('ok',false,'error','La placa ya está asignada o reservada para otro ingreso.');end if;
 insert into public.police_plate_reservations(operation_id,discord_user_id,plate,plate_number) values(p_operation,p_user,candidate,number);
 if p_manual is null then update public.police_plate_counter set next_number=number+1,updated_at=now() where id=1;end if;
 return jsonb_build_object('ok',true,'plate',candidate);
end $$;
revoke all on function public.reserve_police_plate(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_police_plate(uuid,text,text) to service_role;

