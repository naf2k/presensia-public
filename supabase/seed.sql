-- Development-only identities. Password hashes are randomized on every seed;
-- integration tests set temporary passwords through the server-only Auth Admin API.
do $$
declare
  admin_id constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  participant_one_id constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  participant_two_id constant uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  seeded_user record;
begin
  for seeded_user in
    select * from (values
      (admin_id, 'admin@presensia.test', 'Admin Presensia'),
      (participant_one_id, 'participant.one@presensia.test', 'Peserta Fiktif Satu'),
      (participant_two_id, 'participant.two@presensia.test', 'Peserta Fiktif Dua')
    ) as users(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', seeded_user.id,
      'authenticated', 'authenticated', seeded_user.email,
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', seeded_user.full_name),
      now(), now(), '', '', '', ''
    ) on conflict (id) do update set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = now(),
      updated_at = now();

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      seeded_user.id, seeded_user.id::text, seeded_user.id,
      jsonb_build_object('sub', seeded_user.id::text, 'email', seeded_user.email),
      'email', now(), now(), now()
    ) on conflict (provider_id, provider) do update set
      identity_data = excluded.identity_data,
      updated_at = now();
  end loop;
end $$;

insert into public.profiles (id, role, full_name, email, is_active)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin', 'Admin Presensia', 'admin@presensia.test', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'participant', 'Peserta Fiktif Satu', 'participant.one@presensia.test', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'participant', 'Peserta Fiktif Dua', 'participant.two@presensia.test', true)
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name,
  email = excluded.email,
  is_active = excluded.is_active;

insert into public.institutions (id, name, institution_type, city, is_active)
values
  ('11111111-1111-4111-8111-111111111111', 'SMK Contoh Nusantara', 'SMK', 'Kota Contoh', true),
  ('22222222-2222-4222-8222-222222222222', 'Universitas Contoh Indonesia', 'UNIVERSITY', 'Kota Contoh', true)
on conflict (id) do update set
  name = excluded.name,
  institution_type = excluded.institution_type,
  city = excluded.city,
  is_active = excluded.is_active;

insert into public.internships (
  id, participant_id, institution_id, participant_type,
  student_number, major, start_date, end_date, is_active
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '11111111-1111-4111-8111-111111111111',
    'SMK_PKL', 'DEV-001', 'Rekayasa Perangkat Lunak', '2026-01-01', '2027-12-31', true
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '22222222-2222-4222-8222-222222222222',
    'UNIVERSITY_INTERN', 'DEV-002', 'Informatika', '2026-01-01', '2027-12-31', true
  )
on conflict (id) do update set
  institution_id = excluded.institution_id,
  participant_type = excluded.participant_type,
  student_number = excluded.student_number,
  major = excluded.major,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_active = excluded.is_active;

insert into public.attendance_settings (
  id, timezone, work_days, check_in_time, late_tolerance_minutes,
  check_out_time, location_name, latitude, longitude, radius_meters,
  max_location_accuracy_meters, require_checkout_photo, max_journal_length,
  updated_by
)
values (
  '55555555-5555-4555-8555-555555555555',
  'Asia/Jakarta', array[1,2,3,4,5]::smallint[], '08:00', 15,
  '16:00', 'Lokasi Fiktif Pengujian', 0.123456, 100.654321, 150,
  100, false, 500, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
)
on conflict (singleton_key) do update set
  timezone = excluded.timezone,
  work_days = excluded.work_days,
  check_in_time = excluded.check_in_time,
  late_tolerance_minutes = excluded.late_tolerance_minutes,
  check_out_time = excluded.check_out_time,
  location_name = excluded.location_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  radius_meters = excluded.radius_meters,
  max_location_accuracy_meters = excluded.max_location_accuracy_meters,
  require_checkout_photo = excluded.require_checkout_photo,
  max_journal_length = excluded.max_journal_length,
  updated_by = excluded.updated_by,
  updated_at = now();
