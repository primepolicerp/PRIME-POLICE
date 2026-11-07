-- Add metadata without rewriting historical evidence or copying photographs.
alter table public.police_evidence_records
 add column operation text check (operation is null or length(trim(operation)) between 1 and 100),
 add column participants jsonb not null default '[]'::jsonb
 check (case when jsonb_typeof(participants)='array' then jsonb_array_length(participants)<=25 else false end);
comment on column public.police_evidence_records.participants is 'Participant identity snapshots; evidence counters remain attributed to the submitting officer.';

create or replace function public.police_evidence_register(p_search text default '',p_user text default null,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb; needle text;
begin
 if p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit<1 or p_limit>100 or length(coalesce(p_search,''))>100 or (p_user is not null and p_user !~ '^[0-9]{17,20}$') then
  raise exception 'Filtros de evidencias inválidos' using errcode='22023';
 end if;
 needle:=translate(lower(trim(coalesce(p_search,''))),'áéíóúüñ','aeiouun');
 with filtered as materialized (
  select id,discord_user_id,officer_name,plate,operation,participants,locker,objects_description,h50,h50_discord_user_id,h50_discord_username,discord_message_id,channel_id,status,created_at
  from public.police_evidence_records r
  where (p_user is null or r.discord_user_id=p_user)
   and (needle='' or strpos(translate(lower(concat_ws(' ',r.officer_name,r.plate,r.operation,r.participants::text,r.objects_description,r.locker,r.h50,r.h50_discord_username,r.h50_discord_user_id)),'áéíóúüñ','aeiouun'),needle)>0)
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
