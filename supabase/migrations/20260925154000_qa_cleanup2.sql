-- Cleanup .qa drill accounts (import edge verification).
-- Idempotent: safe to re-run.

delete from public.audit_logs
where entity_id in (
  select id::text from public.profiles where email like '%.qa@mail.com'
);

delete from public.attendance_records
where participant_id in (
  select id from public.profiles where email like '%.qa@mail.com'
);

delete from public.journals
where participant_id in (
  select id from public.profiles where email like '%.qa@mail.com'
);

delete from public.leave_requests
where participant_id in (
  select id from public.profiles where email like '%.qa@mail.com'
);

delete from public.internships
where participant_id in (
  select id from public.profiles where email like '%.qa@mail.com'
);

delete from public.operation_log
where user_id in (
  select id from public.profiles where email like '%.qa@mail.com'
);

delete from auth.identities
where user_id in (
  select id from public.profiles where email like '%.qa@mail.com'
);

delete from public.profiles
where email like '%.qa@mail.com';

-- Orphan auth users for those emails (no profile left behind).
delete from auth.users
where email like '%.qa@mail.com'
  and id not in (select id from public.profiles);
