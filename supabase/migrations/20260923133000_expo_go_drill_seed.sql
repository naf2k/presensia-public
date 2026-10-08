-- Expo Go testing seed: clearly-marked SMOKE rows. Removed again after the
-- user finishes device testing (see follow-up cleanup migration).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'authenticated', 'authenticated', 'smoke.drill@presensia.test',
  extensions.crypt('Smokego9A!', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"SMOKE Drill"}'::jsonb,
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
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  jsonb_build_object('sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'email', 'smoke.drill@presensia.test'),
  'email', now(), now(), now()
) on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.institutions (id, name, institution_type, city, is_active)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'SMOKE Drill School', 'SMK', 'SMOKE City', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.profiles (id, role, full_name, email, is_active)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'participant', 'SMOKE Drill', 'smoke.drill@presensia.test', true)
on conflict (id) do update set role = excluded.role, is_active = true;

insert into public.internships (
  participant_id, institution_id, participant_type, student_number, major,
  start_date, end_date, is_active
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'SMK_PKL', 'SMOKE-001', 'SMOKE',
  '2026-09-01', '2026-12-31', true
);
