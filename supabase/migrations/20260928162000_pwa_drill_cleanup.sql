-- PWA drill cleanup: remove temporary [UJI] PWA account and institution.
-- Idempotent: safe to re-run.

delete from public.audit_logs
where entity_id = '11111111-2222-4333-8444-555555555555';

delete from public.attendance_records
where participant_id = '11111111-2222-4333-8444-555555555555';

delete from public.journals
where participant_id = '11111111-2222-4333-8444-555555555555';

delete from public.leave_requests
where participant_id = '11111111-2222-4333-8444-555555555555';

delete from public.internships
where participant_id = '11111111-2222-4333-8444-555555555555';

delete from public.operation_log
where user_id = '11111111-2222-4333-8444-555555555555';

delete from auth.identities
where user_id = '11111111-2222-4333-8444-555555555555';

delete from public.profiles
where id = '11111111-2222-4333-8444-555555555555';

delete from auth.users
where id = '11111111-2222-4333-8444-555555555555';

delete from public.institutions
where id = '22222222-3333-4444-8555-666666666666';
