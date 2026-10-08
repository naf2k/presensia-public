-- PWA drill sementara: 1 peserta + institusi. Dihapus total setelahnya.
-- Akun tidak pernah dipakai selain drill ini.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-2222-4333-8444-555555555555',
  'authenticated', 'authenticated', 'pwa.drill@mail.com',
  extensions.crypt('PwaDrill123', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"[UJI] PWA"}'::jsonb,
  now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  '11111111-2222-4333-8444-555555555555',
  '11111111-2222-4333-8444-555555555555',
  '11111111-2222-4333-8444-555555555555',
  jsonb_build_object('sub', '11111111-2222-4333-8444-555555555555', 'email', 'pwa.drill@mail.com'),
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

insert into public.institutions (id, name, institution_type, city, is_active)
values ('22222222-3333-4444-8555-666666666666', '[UJI] PWA Sekolah', 'SMK', 'Serang', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.profiles (id, role, full_name, email, is_active)
values ('11111111-2222-4333-8444-555555555555', 'participant', '[UJI] PWA', 'pwa.drill@mail.com', true)
on conflict (id) do update set full_name = excluded.full_name, is_active = true;

insert into public.internships (
  participant_id, institution_id, participant_type, student_number, major,
  start_date, end_date, is_active
) values (
  '11111111-2222-4333-8444-555555555555',
  '22222222-3333-4444-8555-666666666666',
  'SMK_PKL', '[UJI]-PWA', 'Uji PWA',
  '2026-09-01', '2026-12-31', true
) on conflict do nothing;
