create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
revoke all on schema net from public,anon,authenticated;
revoke execute on all functions in schema net from public,anon,authenticated;
select cron.schedule('prime-police-notification-retries','*/2 * * * *',$job$
 select net.http_post(
  url:='https://ngkmylqsdeevdtrjrgfn.supabase.co/functions/v1/prime-police-notifications',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='prime_police_notifications_key')),
  body:='{}'::jsonb,timeout_milliseconds:=50000
 );
$job$);
