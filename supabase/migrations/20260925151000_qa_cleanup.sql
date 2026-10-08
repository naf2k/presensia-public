-- QA cleanup: hapus total data audit sementara ([UJI] QA*).
-- Idempotent: safe to re-run.

delete from public.audit_logs
where entity_id in (
  '88888888-8888-4888-8888-888888888888',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc3',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'
);

delete from public.attendance_records
where participant_id = '88888888-8888-4888-8888-888888888888';

-- journal_revisions cascade from journals.
delete from public.journals
where participant_id = '88888888-8888-4888-8888-888888888888';

delete from public.leave_requests
where participant_id = '88888888-8888-4888-8888-888888888888';

delete from public.internships
where participant_id = '88888888-8888-4888-8888-888888888888';

delete from public.operation_log
where user_id = '88888888-8888-4888-8888-888888888888';

delete from public.profiles
where id = '88888888-8888-4888-8888-888888888888';

delete from public.institutions
where id = '99999999-9999-4999-8999-999999999999'
   or lower(name) like '[uji]%';

delete from auth.identities
where user_id = '88888888-8888-4888-8888-888888888888';

delete from auth.users
where id = '88888888-8888-4888-8888-888888888888';
