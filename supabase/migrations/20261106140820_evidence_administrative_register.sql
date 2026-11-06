-- Keep the pilot table and every existing record; future writes need no image URL.
alter table public.police_evidence_records alter column photo_url drop not null;
alter table public.police_evidence_records enable row level security;
revoke all on public.police_evidence_records from public,anon,authenticated;
grant select,insert on public.police_evidence_records to service_role;
create index if not exists police_evidence_date_idx on public.police_evidence_records(created_at desc,id desc);
create index if not exists police_evidence_officer_date_idx on public.police_evidence_records(discord_user_id,created_at desc,id desc);

create or replace function public.police_evidence_register(p_search text default '',p_user text default null,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb; needle text;
begin
 if p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit<1 or p_limit>100 or length(coalesce(p_search,''))>100 or (p_user is not null and p_user !~ '^[0-9]{17,20}$') then
  raise exception 'Filtros de evidencias inválidos' using errcode='22023';
 end if;
 needle:=translate(lower(trim(coalesce(p_search,''))),'áéíóúüñ','aeiouun');
 with filtered as materialized (
  select id,discord_user_id,officer_name,plate,locker,objects_description,h50,discord_message_id,channel_id,status,created_at
  from public.police_evidence_records r
  where (p_user is null or r.discord_user_id=p_user)
   and (needle='' or strpos(translate(lower(concat_ws(' ',r.officer_name,r.plate,r.objects_description,r.locker,r.h50)),'áéíóúüñ','aeiouun'),needle)>0)
 ), page as (select * from filtered order by created_at desc,id desc limit p_limit offset p_offset),
 officers as (
  select discord_user_id,(array_agg(officer_name order by created_at desc,id desc))[1] as officer_name,
   (array_agg(plate order by created_at desc,id desc))[1] as plate,count(*) as total
  from public.police_evidence_records group by discord_user_id
 )
 select jsonb_build_object(
  'records',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
  'total',(select count(*) from filtered),'offset',p_offset,
  'has_more',(select count(*) from filtered)>p_offset+p_limit,
  'next_offset',case when (select count(*) from filtered)>p_offset+p_limit then p_offset+p_limit else null end,
  'summary',jsonb_build_object('records',(select coalesce(sum(total),0) from officers),'officers',(select count(*) from officers)),
  'officer_totals',coalesce((select jsonb_agg(to_jsonb(o) order by o.total desc,o.officer_name,o.discord_user_id) from officers o),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.police_evidence_register(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.police_evidence_register(text,text,integer,integer) to service_role;
