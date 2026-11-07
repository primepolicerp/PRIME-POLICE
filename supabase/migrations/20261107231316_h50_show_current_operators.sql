-- Existing records and open turns are preserved. Only new entries are limited.
create or replace function public.police_h50_event(p_user text,p_start boolean) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare person record; shift public.police_h50_shifts; created boolean;
begin
 if p_user is null or p_user !~ '^[0-9]{17,20}$' or p_start is null then raise exception 'Invalid H50 event' using errcode='22023'; end if;
 if p_start then
  -- Serialize the global capacity check across all bot instances.
  lock table public.police_h50_shifts in share row exclusive mode;
  select * into shift from public.police_h50_shifts where discord_user_id=p_user and ended_at is null;
  if found then return jsonb_build_object('ok',true,'already_open',true,'started_at',shift.started_at,'id',shift.id); end if;
  if (select count(*) from public.police_h50_shifts where ended_at is null)>=2 then return jsonb_build_object('ok',false,'code','capacity_full','limit',2,'active',(select coalesce(jsonb_agg(jsonb_build_object('full_name',a.full_name,'plate',a.plate) order by a.started_at,a.id),'[]'::jsonb) from (select full_name,plate,started_at,id from public.police_h50_shifts where ended_at is null order by started_at,id limit 2) a)); end if;
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

