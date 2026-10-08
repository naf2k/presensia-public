-- PDF drill sementara: 1 peserta [UJI] + 10 baris absensi September 2026
-- (HADIR/TERLAMBAT/IZIN/SAKIT/TIDAK_HADIR + 1 belum check-out).
-- Untuk uji unduh PDF laporan di browser. Dihapus total setelahnya.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-4444-4555-8666-777777777777',
  'authenticated', 'authenticated', 'pdf.drill@mail.com',
  extensions.crypt('PdfDrill123', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"[UJI] PDF"}'::jsonb,
  now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  '33333333-4444-4555-8666-777777777777',
  '33333333-4444-4555-8666-777777777777',
  '33333333-4444-4555-8666-777777777777',
  jsonb_build_object('sub', '33333333-4444-4555-8666-777777777777', 'email', 'pdf.drill@mail.com'),
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

insert into public.institutions (id, name, institution_type, city, is_active)
values ('44444444-5555-4666-8777-888888888888', '[UJI] PDF Sekolah', 'SMK', 'Serang', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.profiles (id, role, full_name, email, is_active)
values ('33333333-4444-4555-8666-777777777777', 'participant', '[UJI] PDF', 'pdf.drill@mail.com', true)
on conflict (id) do update set full_name = excluded.full_name, is_active = true;

insert into public.internships (
  participant_id, institution_id, participant_type, student_number, major,
  start_date, end_date, is_active
) values (
  '33333333-4444-4555-8666-777777777777',
  '44444444-5555-4666-8777-888888888888',
  'SMK_PKL', '[UJI]-PDF', 'Uji PDF',
  '2026-09-01', '2026-12-31', true
) on conflict do nothing;

insert into public.attendance_records (
  participant_id, internship_id, attendance_date, status, source,
  check_in_at, check_out_at, late_minutes,
  check_in_photo_path, check_in_latitude, check_in_longitude,
  check_in_accuracy_m, check_in_distance_m
)
select
  '33333333-4444-4555-8666-777777777777',
  i.id,
  d.attendance_date::date,
  d.status::public.attendance_status,
  d.source::public.attendance_source,
  d.check_in_at::timestamptz,
  d.check_out_at::timestamptz,
  d.late_minutes::integer,
  case when d.check_in_at is null then null else '[UJI]/pdf-' || d.attendance_date || '.jpg' end,
  case when d.check_in_at is null then null else -6.12 end,
  case when d.check_in_at is null then null else 106.15 end,
  case when d.check_in_at is null then null else 10 end,
  case when d.check_in_at is null then null else 50 end
from public.internships i
cross join (values
  ('2026-09-01', 'HADIR', 'CHECK_IN', '2026-09-01 07:25:00+07', '2026-09-01 16:05:00+07', 0),
  ('2026-09-02', 'HADIR', 'CHECK_IN', '2026-09-02 07:20:00+07', '2026-09-02 16:02:00+07', 0),
  ('2026-09-03', 'TERLAMBAT', 'CHECK_IN', '2026-09-03 08:05:00+07', '2026-09-03 16:10:00+07', 35),
  ('2026-09-04', 'HADIR', 'CHECK_IN', '2026-09-04 07:28:00+07', null, 0),
  ('2026-09-07', 'IZIN', 'ADMIN_CORRECTION', null, null, 0),
  ('2026-09-08', 'SAKIT', 'ADMIN_CORRECTION', null, null, 0),
  ('2026-09-09', 'TIDAK_HADIR', 'ADMIN_CORRECTION', null, null, 0),
  ('2026-09-10', 'HADIR', 'CHECK_IN', '2026-09-10 07:22:00+07', '2026-09-10 16:00:00+07', 0),
  ('2026-09-11', 'TERLAMBAT', 'CHECK_IN', '2026-09-11 07:50:00+07', '2026-09-11 16:06:00+07', 20),
  ('2026-09-14', 'HADIR', 'CHECK_IN', '2026-09-14 07:15:00+07', '2026-09-14 15:58:00+07', 0)
) as d(attendance_date, status, source, check_in_at, check_out_at, late_minutes)
where i.participant_id = '33333333-4444-4555-8666-777777777777'
on conflict (participant_id, attendance_date) do nothing;
