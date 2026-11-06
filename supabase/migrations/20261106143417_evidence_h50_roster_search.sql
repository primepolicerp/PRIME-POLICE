create or replace function public.police_evidence_h50_search(p_search text)
returns table(discord_user_id text,full_name text,plate text,discord_username text)
language sql stable security invoker set search_path=public,pg_temp as $$
 select p.discord_user_id::text,p.full_name::text,p.plate::text,p.discord_username::text
 from public.police_personnel p
 where p.status='active' and length(trim(p_search)) between 1 and 100
 and strpos(translate(lower(concat_ws(' ',p.full_name,p.plate,p.discord_username)),'áéíóúüñ','aeiouun'),translate(lower(trim(p_search)),'áéíóúüñ','aeiouun'))>0
 order by p.full_name,p.discord_user_id limit 26
$$;
revoke all on function public.police_evidence_h50_search(text) from public,anon,authenticated;
grant execute on function public.police_evidence_h50_search(text) to service_role;
