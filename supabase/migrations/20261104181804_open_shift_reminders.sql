alter table public.police_discord_jobs drop constraint police_discord_jobs_kind_check;
alter table public.police_discord_jobs add constraint police_discord_jobs_kind_check
 check(kind in ('promotion','departure','dm','weekly_report','shift_reminder'));

create index police_open_shifts_reminder_due on public.police_duty_shifts(started_at,id) where ended_at is null;

-- A unique event per shift survives overlapping workers and later retries.
create function public.enqueue_due_police_shift_reminders() returns integer
language plpgsql security invoker set search_path=public,pg_temp as $$
declare added integer;
begin
 insert into public.police_discord_jobs(event_key,kind,payload)
 select 'shift_reminder:'||s.id,'shift_reminder',jsonb_build_object('shiftId',s.id,'userId',s.discord_user_id)
 from public.police_duty_shifts s
 where s.ended_at is null and s.started_at<now()-interval '2 hours'
 and not exists(select 1 from public.police_discord_jobs j where j.event_key='shift_reminder:'||s.id)
 order by s.started_at,s.id limit 100
 on conflict(event_key) do nothing;
 get diagnostics added=row_count;
 return added;
end $$;
revoke all on function public.enqueue_due_police_shift_reminders() from public,anon,authenticated;
grant execute on function public.enqueue_due_police_shift_reminders() to service_role;
