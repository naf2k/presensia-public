-- PDF drill cleanup: remove temporary [UJI] PDF account and institution.
-- Idempotent: safe to re-run.

delete from public.audit_logs
where entity_id = '33333333-4444-4555-8666-777777777777';

delete from public.attendance_records
where participant_id = '33333333-4444-4555-8666-777777777777';

delete from public.journals
where participant_id = '33333333-4444-4555-8666-777777777777';

delete from public.leave_requests
where participant_id = '33333333-4444-4555-8666-777777777777';

delete from public.internships
where participant_id = '33333333-4444-4555-8666-777777777777';

delete from public.operation_log
where user_id = '33333333-4444-4555-8666-777777777777';

delete from auth.identities
where user_id = '33333333-4444-4555-8666-777777777777';

delete from public.profiles
where id = '33333333-4444-4555-8666-777777777777';

delete from auth.users
where id = '33333333-4444-4555-8666-777777777777';

delete from public.institutions
where id = '44444444-5555-4666-8777-888888888888';
