-- E2E invite drill cleanup: remove quix.tester.88 test participant and the
-- [UJI] E2E institution. Idempotent: safe to re-run.

delete from public.audit_logs
where entity_id in (
  'af9f07f0-0acc-44e8-8459-c986614bb2c5'
);

delete from public.attendance_records
where participant_id = 'af9f07f0-0acc-44e8-8459-c986614bb2c5';

delete from public.journals
where participant_id = 'af9f07f0-0acc-44e8-8459-c986614bb2c5';

delete from public.leave_requests
where participant_id = 'af9f07f0-0acc-44e8-8459-c986614bb2c5';

delete from public.internships
where participant_id = 'af9f07f0-0acc-44e8-8459-c986614bb2c5';

delete from public.operation_log
where user_id = 'af9f07f0-0acc-44e8-8459-c986614bb2c5';

delete from public.profiles
where id = 'af9f07f0-0acc-44e8-8459-c986614bb2c5';

-- Only [UJI]-marked institutions (never real ones like SMK Telkom Bandung).
delete from public.institutions
where lower(name) like '[uji]%';

delete from auth.identities
where user_id = 'af9f07f0-0acc-44e8-8459-c986614bb2c5';

delete from auth.users
where id = 'af9f07f0-0acc-44e8-8459-c986614bb2c5';
