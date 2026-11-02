create function public.police_personnel_career_summary(p_user text)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'total',count(*),'promotions',count(*) filter(where action_type='promotion'),
  'demotions',count(*) filter(where action_type='demotion'),
  'assignments',count(*) filter(where action_type='assignment'),
  'first_record_at',min(created_at),'last_record_at',max(created_at),
  'latest_id',(select id from public.police_rank_history where discord_user_id=p_user order by created_at desc,id desc limit 1)
 ) from public.police_rank_history where discord_user_id=p_user;
$$;
revoke all on function public.police_personnel_career_summary(text) from public,anon,authenticated;
grant execute on function public.police_personnel_career_summary(text) to service_role;
