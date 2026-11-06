-- Fresh roster reads on every group request: no copied or cached personnel lists.
create or replace function public.police_evidence_h50_initials(p_group text,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_group is null or p_group not in ('AF','GL','MR','SZ') or p_offset is null or p_offset<0 or p_offset>1000000 then
  raise exception 'Grupo de plantilla no válido' using errcode='22023';
 end if;
 with eligible as (
  select discord_user_id,full_name,plate,discord_username,
  translate(lower(left(trim(full_name),1)),'áéíóúüñ','aeiouun') as initial
  from public.police_personnel where status='active'
 ), filtered as materialized (
  select discord_user_id,full_name,plate,discord_username from eligible
  where (p_group='AF' and initial between 'a' and 'f')
   or (p_group='GL' and initial between 'g' and 'l')
   or (p_group='MR' and initial between 'm' and 'r')
   or (p_group='SZ' and (initial between 's' and 'z' or initial not between 'a' and 'z' or initial is null))
 ), page as (select * from filtered order by full_name,discord_user_id limit 25 offset p_offset)
 select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(p) order by p.full_name,p.discord_user_id) from page p),'[]'::jsonb),
  'total',(select count(*) from filtered),'has_more',(select count(*) from filtered)>p_offset+25,
  'next_offset',case when (select count(*) from filtered)>p_offset+25 then p_offset+25 else null end) into result;
 return result;
end;
$$;
revoke all on function public.police_evidence_h50_initials(text,integer) from public,anon,authenticated;
grant execute on function public.police_evidence_h50_initials(text,integer) to service_role;
