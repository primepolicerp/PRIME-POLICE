-- Add identity metadata only. Photographs and existing evidence text remain unchanged.
alter table public.police_evidence_records add column if not exists h50_discord_user_id text check (h50_discord_user_id ~ '^[0-9]{17,20}$');
alter table public.police_evidence_records add column if not exists h50_discord_username text;
-- Canonical full-name/plate match. Never infer a user from a partial name.
update public.police_evidence_records e set h50_discord_user_id=p.discord_user_id,h50_discord_username=p.discord_username
from public.police_personnel p where e.h50_discord_user_id is null
and e.h50=p.full_name || ' · #' || p.plate;
-- The project owner explicitly confirmed the identity of this historical "Pedro" record.
update public.police_evidence_records e set h50_discord_user_id=p.discord_user_id,h50_discord_username=p.discord_username
from public.police_personnel p where e.id='72431d5f-e3ae-4840-a7b2-6ea981bfb19f'
and e.h50='Pedro' and e.h50_discord_user_id is null and p.discord_user_id='698630509143654541';
create or replace function public.police_evidence_register(p_search text default '',p_user text default null,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb; needle text;
begin
 if p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit<1 or p_limit>100 or length(coalesce(p_search,''))>100 or (p_user is not null and p_user !~ '^[0-9]{17,20}$') then
  raise exception 'Filtros de evidencias inválidos' using errcode='22023';
 end if;
 needle:=translate(lower(trim(coalesce(p_search,''))),'áéíóúüñ','aeiouun');
 with filtered as materialized (
  select id,discord_user_id,officer_name,plate,locker,objects_description,h50,h50_discord_user_id,h50_discord_username,discord_message_id,channel_id,status,created_at
  from public.police_evidence_records r
  where (p_user is null or r.discord_user_id=p_user)
   and (needle='' or strpos(translate(lower(concat_ws(' ',r.officer_name,r.plate,r.objects_description,r.locker,r.h50,r.h50_discord_username,r.h50_discord_user_id)),'áéíóúüñ','aeiouun'),needle)>0)
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
