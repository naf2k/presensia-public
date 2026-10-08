-- Production cleanup: remove fictitious seed/test data (participants, example
-- institutions, attendance, journals, leave requests, test files, test audit
-- trail). Keeps the admin account and the attendance_settings singleton.
-- Idempotent: safe to re-run. Backup stored in docs/release/backup-*.json.
DELETE FROM public.audit_logs;

DELETE FROM public.attendance_records
WHERE participant_id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);

DELETE FROM public.journals
WHERE participant_id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);

DELETE FROM public.leave_requests
WHERE participant_id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);

DELETE FROM public.internships
WHERE participant_id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);

-- NOTE: storage.objects cannot be deleted by SQL (platform restriction);
-- test files are removed via the Storage API as the owning participant before
-- this migration runs. See release report.

DELETE FROM public.profiles
WHERE id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);

DELETE FROM public.institutions
WHERE id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

DELETE FROM auth.identities
WHERE user_id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);

DELETE FROM auth.users
WHERE id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);
