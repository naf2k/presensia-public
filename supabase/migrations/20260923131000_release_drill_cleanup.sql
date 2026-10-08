-- Release drill cleanup: remove SMOKE rows created by
-- 20260923130500_release_drill_seed.sql plus the drill journal/leave and the
-- release-verification audit trail, restoring a pristine production state.
-- Keeps the admin account and the attendance_settings singleton.
DELETE FROM public.audit_logs;

DELETE FROM public.leave_requests
WHERE participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

DELETE FROM public.journals
WHERE participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

DELETE FROM public.internships
WHERE participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

DELETE FROM public.profiles
WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

DELETE FROM public.institutions
WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

DELETE FROM auth.identities
WHERE user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

DELETE FROM auth.users
WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
