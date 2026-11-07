-- H-50 is a separate clock; existing police service and evidence records are untouched.
create table public.police_h50_shifts (
 id uuid primary key default gen_random_uuid(),
 discord_user_id text not null check(discord_user_id ~ '^[0-9]{17,20}$'),
 full_name text not null, plate text not null default '',
 unit text not null check(unit in ('POLICIA','UCOP','CIC')),
 started_at timestamptz not null default now(), ended_at timestamptz,
 closed_by text, close_reason text, adjustments jsonb not null default '[]'::jsonb,
 check(isfinite(started_at) and (ended_at is null or (isfinite(ended_at) and ended_at>=started_at)))
);
create unique index police_h50_one_open on public.police_h50_shifts(discord_user_id) where ended_at is null;
create index police_h50_recent on public.police_h50_shifts(started_at desc,id desc);
create index police_h50_user_recent on public.police_h50_shifts(discord_user_id,started_at desc);
alter table public.police_h50_shifts enable row level security;
revoke all on public.police_h50_shifts from public,anon,authenticated;
grant select,insert,update on public.police_h50_shifts to service_role;

create function public.police_h50_event(p_user text,p_start boolean) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare person record; shift public.police_h50_shifts; created boolean;
begin
 if p_user is null or p_user !~ '^[0-9]{17,20}$' or p_start is null then raise exception 'Invalid H50 event' using errcode='22023'; end if;
 if p_start then
  select full_name,plate,unit into person from public.police_personnel where discord_user_id=p_user and status='active';
  if not found or person.unit not in ('POLICIA','UCOP','CIC') then return jsonb_build_object('ok',false,'code','inactive'); end if;
  insert into public.police_h50_shifts(discord_user_id,full_name,plate,unit)
  values(p_user,person.full_name,coalesce(person.plate,''),person.unit)
  on conflict(discord_user_id) where ended_at is null do nothing returning * into shift;
  created:=found;
  if not created then select * into shift from public.police_h50_shifts where discord_user_id=p_user and ended_at is null; end if;
  return jsonb_build_object('ok',true,'already_open',not created,'started_at',shift.started_at,'id',shift.id);
 end if;
 update public.police_h50_shifts set ended_at=greatest(now(),started_at),closed_by=p_user,close_reason='Salida de H-50 registrada por el policía'
 where discord_user_id=p_user and ended_at is null returning * into shift;
 if not found then return jsonb_build_object('ok',true,'no_open',true); end if;
 return jsonb_build_object('ok',true,'id',shift.id,'started_at',shift.started_at,'ended_at',shift.ended_at,'seconds',greatest(0,extract(epoch from shift.ended_at-shift.started_at)));
end; $$;

create function public.police_h50_register(p_from timestamptz,p_to timestamptz,p_search text default '',p_user text default null,p_state text default 'open',p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_from>=p_to or p_to-p_from>interval '366 days'
 or length(coalesce(p_search,''))>100 or (p_user is not null and p_user !~ '^[0-9]{17,20}$') or p_state not in ('open','history') or p_state is null or p_offset is null or p_offset<0 or p_offset>1000000 then raise exception 'Filtros H50 inválidos' using errcode='22023'; end if;
 with filtered as materialized (
  select s.*,greatest(0,extract(epoch from least(coalesce(ended_at,now()),p_to,now())-greatest(started_at,p_from))) as seconds_period
  from public.police_h50_shifts s where started_at<p_to and coalesce(ended_at,now())>=p_from
   and (p_user is null or discord_user_id=p_user)
   and (trim(coalesce(p_search,''))='' or strpos(lower(concat_ws(' ',full_name,plate)),lower(trim(p_search)))>0)
 ), visible as materialized (
  select * from filtered where (p_state='open' and ended_at is null) or (p_state='history' and ended_at is not null)
 ), page as (
  select id,discord_user_id,full_name,plate,unit,started_at,ended_at,closed_by,close_reason,seconds_period from visible order by started_at desc,id desc limit 50 offset p_offset
 ), people as (
  select discord_user_id,(array_agg(full_name order by started_at desc,id desc))[1] as full_name,(array_agg(plate order by started_at desc,id desc))[1] as plate,
   count(*) as shifts,count(*) filter(where ended_at is null) as open,sum(seconds_period) as seconds
  from filtered group by discord_user_id
 )
 select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(page) order by started_at desc,id desc) from page),'[]'::jsonb),
 'summary',(select jsonb_build_object('shifts',count(*),'open',count(*) filter(where ended_at is null),'officers',count(distinct discord_user_id),'seconds',coalesce(sum(seconds_period),0)) from filtered),
 'officers',coalesce((select jsonb_agg(to_jsonb(people) order by seconds desc,full_name,discord_user_id) from people),'[]'::jsonb),
 'total',(select count(*) from visible),'next_offset',case when (select count(*) from visible)>p_offset+50 then p_offset+50 else null end) into result;
 return result;
end; $$;

create function public.police_h50_admin_close(p_id uuid,p_started timestamptz,p_ended timestamptz,p_expected timestamptz,p_actor text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare old public.police_h50_shifts;
begin
 if p_started is null or p_ended is null or p_expected is null or not isfinite(p_started) or not isfinite(p_ended) or p_ended<p_started or p_ended>now()+interval '1 minute'
 or p_actor is null or p_actor !~ '^[0-9]{17,20}$' or length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>500 then raise exception 'Cierre H50 inválido' using errcode='22023'; end if;
 select * into old from public.police_h50_shifts where id=p_id for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
 if old.ended_at is not null or old.started_at<>p_expected then return jsonb_build_object('ok',false,'code','conflict'); end if;
 update public.police_h50_shifts set started_at=p_started,ended_at=p_ended,closed_by=p_actor,close_reason=trim(p_reason),
 adjustments=adjustments||jsonb_build_array(jsonb_build_object('actor',p_actor,'at',now(),'reason',trim(p_reason),'before',jsonb_build_object('started_at',old.started_at,'ended_at',old.ended_at),'after',jsonb_build_object('started_at',p_started,'ended_at',p_ended))) where id=p_id;
 return jsonb_build_object('ok',true,'message','Turno H-50 ajustado y cerrado. Corrección guardada en la auditoría del registro.');
end; $$;
revoke all on function public.police_h50_event(text,boolean) from public,anon,authenticated;
revoke all on function public.police_h50_register(timestamptz,timestamptz,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.police_h50_admin_close(uuid,timestamptz,timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.police_h50_event(text,boolean),public.police_h50_register(timestamptz,timestamptz,text,text,text,integer),public.police_h50_admin_close(uuid,timestamptz,timestamptz,timestamptz,text,text) to service_role;
