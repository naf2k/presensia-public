-- QA audit sementara ([UJI] QA): data untuk verifikasi visual seluruh halaman
-- admin. Dihapus total oleh migrasi cleanup berikutnya. Akun tidak login.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-4888-8888-888888888888',
  'authenticated', 'authenticated', 'uji.qa@presensia.test',
  extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"[UJI] QA"}'::jsonb,
  now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  '88888888-8888-4888-8888-888888888888',
  '88888888-8888-4888-8888-888888888888',
  '88888888-8888-4888-8888-888888888888',
  jsonb_build_object('sub', '88888888-8888-4888-8888-888888888888', 'email', 'uji.qa@presensia.test'),
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

insert into public.institutions (id, name, institution_type, city, is_active)
values ('99999999-9999-4999-8999-999999999999', '[UJI] QA Sekolah', 'SMK', 'Serang', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.profiles (id, role, full_name, email, phone, is_active)
values ('88888888-8888-4888-8888-888888888888', 'participant', '[UJI] QA Peserta', 'uji.qa@presensia.test', '0812000000', true)
on conflict (id) do update set full_name = excluded.full_name, is_active = true;

insert into public.internships (
  participant_id, institution_id, participant_type, student_number, major,
  start_date, end_date, is_active
) values (
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'SMK_PKL', '[UJI]-QA', 'Uji QA',
  '2026-09-01', '2026-12-31', true
) on conflict do nothing;

-- PENDING leave dulu (trigger mewajibkan insert PENDING).
insert into public.leave_requests (
  id, participant_id, internship_id, type, start_date, end_date, reason, status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1',
  '88888888-8888-4888-8888-888888888888',
  (select id from public.internships where participant_id = '88888888-8888-4888-8888-888888888888' and is_active limit 1),
  'IZIN', '2026-09-25', '2026-09-25', 'Uji QA audit izin sakit.', 'PENDING'
), (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2',
  '88888888-8888-4888-8888-888888888888',
  (select id from public.internships where participant_id = '88888888-8888-4888-8888-888888888888' and is_active limit 1),
  'SAKIT', '2026-09-21', '2026-09-21', 'Uji QA sakit disetujui.', 'PENDING'
) on conflict (id) do nothing;

update public.leave_requests
set status = 'APPROVED',
    reviewed_by = (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
    reviewed_at = now(),
    admin_note = 'Disetujui untuk drill QA.'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2' and status = 'PENDING';

insert into public.attendance_records (
  id, participant_id, internship_id, attendance_date, status, source,
  check_in_at, check_in_photo_path, check_in_latitude, check_in_longitude,
  check_in_accuracy_m, check_in_distance_m, late_minutes,
  check_out_at, check_out_photo_path
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1',
  '88888888-8888-4888-8888-888888888888',
  (select id from public.internships where participant_id = '88888888-8888-4888-8888-888888888888' and is_active limit 1),
  '2026-09-23', 'HADIR', 'CHECK_IN',
  '2026-09-23T00:30:00+00:00', '88888888-8888-4888-8888-888888888888/2026-09-23/qa-c1.jpg',
  -6.162464, 106.142273, 10, 5, 0,
  '2026-09-23T09:00:00+00:00', '88888888-8888-4888-8888-888888888888/2026-09-23/qa-c1-out.jpg'
), (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2',
  '88888888-8888-4888-8888-888888888888',
  (select id from public.internships where participant_id = '88888888-8888-4888-8888-888888888888' and is_active limit 1),
  '2026-09-24', 'TERLAMBAT', 'CHECK_IN',
  '2026-09-24T03:00:00+00:00', '88888888-8888-4888-8888-888888888888/2026-09-24/qa-c2.jpg',
  -6.162464, 106.142273, 12, 8, 135,
  '2026-09-24T09:00:00+00:00', null
) on conflict (participant_id, attendance_date) do nothing;

insert into public.attendance_records (
  id, participant_id, internship_id, leave_request_id, attendance_date, status, source
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc3',
  '88888888-8888-4888-8888-888888888888',
  (select id from public.internships where participant_id = '88888888-8888-4888-8888-888888888888' and is_active limit 1),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2',
  '2026-09-21', 'SAKIT', 'LEAVE'
) on conflict (participant_id, attendance_date) do nothing;

-- Jurnal + revisi via trigger (insert lalu update).
insert into public.journals (id, participant_id, internship_id, attendance_id, journal_date, content)
values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccd1',
  '88888888-8888-4888-8888-888888888888',
  (select id from public.internships where participant_id = '88888888-8888-4888-8888-888888888888' and is_active limit 1),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1',
  '2026-09-23', 'Apel pagi.'
), (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccd2',
  '88888888-8888-4888-8888-888888888888',
  (select id from public.internships where participant_id = '88888888-8888-4888-8888-888888888888' and is_active limit 1),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2',
  '2026-09-24', 'Entri data arsip.'
) on conflict (participant_id, journal_date) do nothing;

update public.journals
set content = 'Apel pagi, briefing divisi, dan penataan ruang arsip.'
where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccd1' and content = 'Apel pagi.';

insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data, reason)
values (
  (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
  'PARTICIPANT_CREATED', 'participant', '88888888-8888-4888-8888-888888888888',
  jsonb_build_object('full_name', '[UJI] QA Peserta'),
  'Seed QA audit (sementara).'
), (
  (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
  'LEAVE_APPROVED', 'leave_request', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2',
  jsonb_build_object('status', 'APPROVED'),
  'Seed QA audit (sementara).'
);
