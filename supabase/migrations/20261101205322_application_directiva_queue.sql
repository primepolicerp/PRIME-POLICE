-- A queued decision has one review path: Directiva. Resolved records remain in history.
create index police_change_requests_application_queue
 on public.police_change_requests ((payload->>'id'))
 where action='decision' and status in ('pending','processing');

create view public.police_available_applications with (security_invoker = true) as
 select a.* from public.police_applications a
 where a.status <> 'pending' or not exists (
  select 1 from public.police_change_requests q
  where q.action='decision' and q.status in ('pending','processing')
   and q.payload->>'id'=a.id::text
 );
revoke all on public.police_available_applications from public, anon, authenticated;
grant select on public.police_available_applications to service_role;

-- Retire obsolete pending proposals without changing an application or inventing a reviewer.
-- Accepted-role retries and explicit rejection corrections are intentional exceptions.
update public.police_change_requests q
set status='failed', reviewed_at=now(),
 result_message='Propuesta cerrada: la postulación ya fue resuelta. No se ha aplicado ningún cambio.',
 review_reason='La postulación se resolvió antes de revisar esta propuesta.'
from public.police_applications a
where q.action='decision' and q.status='pending' and q.payload->>'id'=a.id::text
 and a.status <> 'pending'
 and not (a.status='rejected' and q.payload->>'action'='accept' and coalesce(q.payload->>'correct_rejection'='true',false))
 and not (a.status='accepted' and a.role_assigned_at is null and q.payload->>'action'='accept');
