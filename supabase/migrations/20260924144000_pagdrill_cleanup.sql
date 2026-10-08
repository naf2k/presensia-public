-- Fase 6: hapus total data drill paginasi sementara ([UJI] Paginasi, [UJI] Kedua).
-- Idempotent: safe to re-run. Tidak menyentuh jejak admin asli.

delete from public.audit_logs
where entity_id in (
  '77777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
);

delete from public.attendance_records
where participant_id = '77777777-7777-4777-8777-777777777777';

-- journal_revisions cascade from journals.
delete from public.journals
where participant_id = '77777777-7777-4777-8777-777777777777';

delete from public.leave_requests
where participant_id = '77777777-7777-4777-8777-777777777777';

delete from public.internships
where participant_id = '77777777-7777-4777-8777-777777777777';

delete from public.operation_log
where user_id = '77777777-7777-4777-8777-777777777777';

delete from public.profiles
where id = '77777777-7777-4777-8777-777777777777';

delete from public.institutions
where id in (
  '66666666-6666-4666-8666-666666666666',
  '7851bd5f-9764-49b1-b1e7-07e09ffb7172'
) or lower(name) like '[uji]%';

delete from auth.identities
where user_id = '77777777-7777-4777-8777-777777777777';

delete from auth.users
where id = '77777777-7777-4777-8777-777777777777';
