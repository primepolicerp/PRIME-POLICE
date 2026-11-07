-- Read-only aggregation; existing shifts and their history are not rewritten.
create function public.police_shift_overview(p_from timestamptz,p_to timestamptz,p_search text default '',p_unit text default null,p_user text default null)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb; needle text;
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_from>=p_to or p_to-p_from>interval '366 days'
 or length(coalesce(p_search,''))>100 or (p_unit is not null and p_unit not in ('POLICIA','UCOP','CIC')) or (p_user is not null and p_user !~ '^[0-9]{17,20}$') then
  raise exception 'Filtros de bitácoras inválidos' using errcode='22023';
 end if;
 needle:=lower(trim(coalesce(p_search,''))); 
 with filtered as materialized (
  select s.*,greatest(s.started_at,p_from) as span_start,least(coalesce(s.ended_at,now()),p_to) as span_end
  from public.police_duty_shifts s
  where s.started_at<p_to and (coalesce(s.ended_at,now())>p_from or (s.started_at=p_from and s.ended_at=p_from))
   and (p_unit is null or s.unit=p_unit) and (p_user is null or s.discord_user_id=p_user)
   and (needle='' or strpos(lower(concat_ws(' ',s.full_name,s.plate)),needle)>0)
 ), daily as (
  select day::date as date,count(*) as shifts,count(*) filter(where f.ended_at is null) as open,
   sum(greatest(0,extract(epoch from (least(f.span_end,(day::date+1)::timestamp at time zone 'Europe/Paris')-greatest(f.span_start,day::date::timestamp at time zone 'Europe/Paris'))))) as seconds
  from filtered f cross join lateral generate_series((f.span_start at time zone 'Europe/Paris')::date::timestamp,
   (case when f.span_end>f.span_start then f.span_end-interval '1 microsecond' else f.span_start end at time zone 'Europe/Paris')::date::timestamp,interval '1 day') day
  where f.span_end>=f.span_start
  group by day::date
 )
 select jsonb_build_object('total',count(*),'open',count(*) filter(where ended_at is null),
 'completed',count(*) filter(where ended_at is not null),'incomplete',count(*) filter(where ended_at is not null and ended_at-started_at<interval '30 minutes'),
 'officers',count(distinct discord_user_id),'service_seconds',coalesce(sum(greatest(0,extract(epoch from (span_end-span_start)))),0),
 'days',coalesce((select jsonb_agg(to_jsonb(d) order by d.date) from daily d),'[]'::jsonb)) into result from filtered;
 return result;
end;
$$;
revoke all on function public.police_shift_overview(timestamptz,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.police_shift_overview(timestamptz,timestamptz,text,text,text) to service_role;
