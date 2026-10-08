-- Fase 0 cleanup: remove Expo Go SMOKE test rows. Approved by owner on
-- 2026-09-24 after live audit confirmed zero real participant data.
-- Backup snapshot: docs/ops/backup-2026-09-24.json.
-- Forward-only; safe to replay (guarded by fixed test UUIDs).

delete from public.journals
where participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

delete from public.attendance_records
where participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

delete from public.leave_requests
where participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

delete from public.internships
where participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

delete from public.profiles
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

delete from public.institutions
where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

delete from auth.identities
where user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

delete from auth.users
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
