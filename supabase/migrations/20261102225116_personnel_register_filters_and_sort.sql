-- One private read supplies filters, ordering, availability and pagination.
create function public.police_personnel_register(
 p_status text default '',p_rank text default '',p_unit text default '',p_search text default '',
 p_plate_from numeric default null,p_plate_to numeric default null,p_sort text default 'plate',p_desc boolean default false,
 p_offset integer default 0,p_limit integer default 25,p_target text default null,p_counts boolean default false
) returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_status not in ('','active','inactive','available','absence') or p_unit not in ('','POLICIA','UCOP','CIC') or p_sort not in ('plate','name','rank','unit','discord','state') or p_offset<0 or p_offset>1000000 or p_limit<1 or p_limit>100 or length(p_search)>100 or length(p_rank)>100 or (p_target is not null and p_target!~'^[0-9]{17,20}$') or p_plate_from<0 or p_plate_to<0 or p_plate_from>p_plate_to then raise exception 'Invalid personnel list filters';end if;
 with base as (
  select p.*,r.rank_order as roster_rank_order,
   p.status='active' and exists(select 1 from public.police_absence_requests a where a.discord_user_id=p.discord_user_id and a.status='approved' and a.start_date<=(now() at time zone 'Europe/Paris')::date and a.end_date>=(now() at time zone 'Europe/Paris')::date) as on_absence
  from public.police_personnel p left join public.police_rank_roles r on r.role_id=p.rank_role_id
 ),filtered as (
  select * from base where (p_status='' or (p_status='active' and status='active') or (p_status='inactive' and status='inactive') or (p_status='available' and status='active' and not on_absence) or (p_status='absence' and on_absence))
   and (p_rank='' or rank_name=p_rank) and (p_unit='' or unit=p_unit) and (p_target is null or discord_user_id=p_target)
   and (p_plate_from is null or plate_number>=p_plate_from) and (p_plate_to is null or plate_number<=p_plate_to)
   and (p_search='' or full_name ilike '%'||p_search||'%' or discord_username ilike '%'||p_search||'%' or discord_user_id ilike '%'||p_search||'%' or plate ilike '%'||p_search||'%' or rank_name ilike '%'||p_search||'%' or name_ooc ilike '%'||p_search||'%')
 ),ordered as (
  select *,row_number() over(order by
   case when p_sort='plate' and not p_desc then plate_number end asc nulls last,
   case when p_sort='plate' and p_desc then plate_number end desc nulls last,
   case when p_sort='name' and not p_desc then lower(full_name) end asc nulls last,
   case when p_sort='name' and p_desc then lower(full_name) end desc nulls last,
   case when p_sort='rank' and not p_desc then roster_rank_order end asc nulls last,
   case when p_sort='rank' and p_desc then roster_rank_order end desc nulls last,
   case when p_sort='unit' and not p_desc then unit end asc nulls last,
   case when p_sort='unit' and p_desc then unit end desc nulls last,
   case when p_sort='discord' and not p_desc then lower(discord_username) end asc nulls last,
   case when p_sort='discord' and p_desc then lower(discord_username) end desc nulls last,
   case when p_sort='state' and not p_desc then case when status='inactive' then 2 when on_absence then 1 else 0 end end asc,
   case when p_sort='state' and p_desc then case when status='inactive' then 2 when on_absence then 1 else 0 end end desc,
   plate_number asc nulls last,plate asc,discord_user_id asc) as roster_position from filtered
 ),page as(select * from ordered order by roster_position limit p_limit offset p_offset)
 select jsonb_build_object('ok',true,'records',coalesce((select jsonb_agg(to_jsonb(t)-'roster_rank_order'-'roster_position' order by roster_position) from page t),'[]'::jsonb),
  'total',(select count(*) from filtered),'next_offset',case when p_offset+p_limit<(select count(*) from filtered) then p_offset+p_limit end,
  'counts',case when p_counts then(select jsonb_build_object('active',count(*) filter(where status='active'),'inactive',count(*) filter(where status='inactive'),'absence',count(*) filter(where on_absence),'available',count(*) filter(where status='active' and not on_absence)) from base) else '{}'::jsonb end) into result;
 return result;
end $$;
revoke all on function public.police_personnel_register(text,text,text,text,numeric,numeric,text,boolean,integer,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.police_personnel_register(text,text,text,text,numeric,numeric,text,boolean,integer,integer,text,boolean) to service_role;
