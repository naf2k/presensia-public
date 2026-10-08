-- Cleanup akun uji single-create UI (single.ui@mail.com).
-- Idempotent: safe to re-run.

delete from public.audit_logs
where entity_id in (
  select id::text from public.profiles where email = 'single.ui@mail.com'
);

delete from public.attendance_records
where participant_id in (
  select id from public.profiles where email = 'single.ui@mail.com'
);

delete from public.journals
where participant_id in (
  select id from public.profiles where email = 'single.ui@mail.com'
);

delete from public.leave_requests
where participant_id in (
  select id from public.profiles where email = 'single.ui@mail.com'
);

delete from public.internships
where participant_id in (
  select id from public.profiles where email = 'single.ui@mail.com'
);

delete from public.operation_log
where user_id in (
  select id from public.profiles where email = 'single.ui@mail.com'
);

delete from auth.identities
where user_id in (
  select id from public.profiles where email = 'single.ui@mail.com'
);

delete from public.profiles
where email = 'single.ui@mail.com';

delete from auth.users
where email = 'single.ui@mail.com'
  and id not in (select id from public.profiles);
