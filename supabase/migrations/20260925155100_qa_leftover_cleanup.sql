-- Cleanup sisa satu akun drill (bima.qa) yang lolos dari polaLIKE sebelumnya.
-- Idempotent: safe to re-run.

delete from public.audit_logs
where entity_id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';

delete from public.attendance_records
where participant_id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';

delete from public.journals
where participant_id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';

delete from public.leave_requests
where participant_id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';

delete from public.internships
where participant_id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';

delete from public.operation_log
where user_id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';

delete from auth.identities
where user_id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';

delete from public.profiles
where id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';

delete from auth.users
where id = 'f9d5c1d9-b2a4-435e-8afa-e110afe9729f';
