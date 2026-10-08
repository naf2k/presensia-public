-- Fase 6 (sementara): seed drill paginasi server + tulis institusi.
-- Data bertanda [UJI] dan dihapus total oleh 20260924144000_pagdrill_cleanup.sql.
-- TIDAK untuk operasional: akun tidak pernah login (password acak, tidak dibagikan).

-- auth user (tanpa login; hanya memenuhi FK profiles.id -> auth.users.id)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777777',
  'authenticated', 'authenticated', 'uji.paginasi@presensia.test',
  extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"[UJI] Paginasi"}'::jsonb,
  now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  '77777777-7777-4777-8777-777777777777',
  '77777777-7777-4777-8777-777777777777',
  '77777777-7777-4777-8777-777777777777',
  jsonb_build_object('sub', '77777777-7777-4777-8777-777777777777', 'email', 'uji.paginasi@presensia.test'),
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

insert into public.institutions (id, name, institution_type, city, is_active)
values ('66666666-6666-4666-8666-666666666666', '[UJI] Paginasi', 'SMK', 'Serang', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.profiles (id, role, full_name, email, is_active)
values ('77777777-7777-4777-8777-777777777777', 'participant', '[UJI] Paginasi', 'uji.paginasi@presensia.test', true)
on conflict (id) do update set full_name = excluded.full_name, is_active = true;

insert into public.internships (
  participant_id, institution_id, participant_type, student_number, major,
  start_date, end_date, is_active
) values (
  '77777777-7777-4777-8777-777777777777',
  '66666666-6666-4666-8666-666666666666',
  'SMK_PKL', '[UJI]-PAG', 'Uji Paginasi',
  '2026-09-01', '2026-12-31', true
) on conflict do nothing;

-- Leaves dulu (attendance IZIN mereferensikannya).
-- Leave inserts must land as PENDING (trigger); approval via update like review-leave.
insert into public.leave_requests (
  id, participant_id, internship_id, type, start_date, end_date, reason, status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '77777777-7777-4777-8777-777777777777',
  (select id from public.internships where participant_id = '77777777-7777-4777-8777-777777777777' and is_active limit 1),
  'IZIN', '2026-09-24', '2026-09-24', 'Uji paginasi.', 'PENDING'
) on conflict (id) do nothing;

update public.leave_requests
set status = 'APPROVED',
    reviewed_by = (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
    reviewed_at = now(),
    admin_note = 'Disetujui untuk drill.'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and status = 'PENDING';

insert into public.leave_requests (
  id, participant_id, internship_id, type, start_date, end_date, reason, status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  '77777777-7777-4777-8777-777777777777',
  (select id from public.internships where participant_id = '77777777-7777-4777-8777-777777777777' and is_active limit 1),
  'SAKIT', '2026-09-29', '2026-09-29', 'Uji paginasi pending.', 'PENDING'
) on conflict (id) do nothing;

insert into public.attendance_records (
  id, participant_id, internship_id, attendance_date, status, source,
  check_in_at, check_in_photo_path, check_in_latitude, check_in_longitude,
  check_in_accuracy_m, check_in_distance_m, late_minutes,
  check_out_at, check_out_photo_path
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '77777777-7777-4777-8777-777777777777',
  (select id from public.internships where participant_id = '77777777-7777-4777-8777-777777777777' and is_active limit 1),
  '2026-09-22', 'HADIR', 'CHECK_IN',
  '2026-09-22T00:30:00+00:00', '77777777-7777-4777-8777-777777777777/2026-09-22/pag-a1.jpg',
  -6.162464, 106.142273, 10, 5, 0,
  '2026-09-22T09:00:00+00:00', '77777777-7777-4777-8777-777777777777/2026-09-22/pag-a1-out.jpg'
), (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '77777777-7777-4777-8777-777777777777',
  (select id from public.internships where participant_id = '77777777-7777-4777-8777-777777777777' and is_active limit 1),
  '2026-09-23', 'TERLAMBAT', 'CHECK_IN',
  '2026-09-23T03:00:00+00:00', '77777777-7777-4777-8777-777777777777/2026-09-23/pag-a2.jpg',
  -6.162464, 106.142273, 12, 8, 135,
  '2026-09-23T09:00:00+00:00', null
) on conflict (participant_id, attendance_date) do nothing;

insert into public.attendance_records (
  id, participant_id, internship_id, leave_request_id, attendance_date, status, source
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  '77777777-7777-4777-8777-777777777777',
  (select id from public.internships where participant_id = '77777777-7777-4777-8777-777777777777' and is_active limit 1),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '2026-09-24', 'IZIN', 'LEAVE'
) on conflict (participant_id, attendance_date) do nothing;

-- Jurnal: J1 memuat koma dan % untuk menguji escapeLike + revisi ganda.
-- Alur tulis menyerupai edit asli: insert lalu update sehingga trigger
-- mencatat rev1 ("Rapat pagi.") dan rev2 (konten final).
insert into public.journals (id, participant_id, internship_id, attendance_id, journal_date, content)
values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  '77777777-7777-4777-8777-777777777777',
  (select id from public.internships where participant_id = '77777777-7777-4777-8777-777777777777' and is_active limit 1),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '2026-09-22', 'Rapat pagi.'
), (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  '77777777-7777-4777-8777-777777777777',
  (select id from public.internships where participant_id = '77777777-7777-4777-8777-777777777777' and is_active limit 1),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '2026-09-23', 'Verifikasi berkas magang.'
) on conflict (participant_id, journal_date) do nothing;

update public.journals
set content = 'Rapat, koordinasi 100% selesai.'
where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  and content = 'Rapat pagi.';

insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data, reason)
values (
  (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
  'PARTICIPANT_CREATED', 'participant', '77777777-7777-4777-8777-777777777777',
  jsonb_build_object('full_name', '[UJI] Paginasi'),
  'Seed drill paginasi (sementara).'
), (
  (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
  'LEAVE_APPROVED', 'leave_request', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  jsonb_build_object('status', 'APPROVED'),
  'Seed drill paginasi (sementara).'
);
