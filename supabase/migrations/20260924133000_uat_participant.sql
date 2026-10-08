-- Fase 3 UAT: clearly-marked test participant for end-to-end drill
-- (check-in/out, snapshot, absence job) and owner device testing.
-- Temporary password MUST be rotated before production use.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '569eafb9-ebe1-45af-a307-cf437a8930b2',
  'authenticated', 'authenticated', 'uji.coba@presensia.test',
  extensions.crypt('s5TYNXuM258zdyP', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"[UJI] Coba"}'::jsonb,
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
  '569eafb9-ebe1-45af-a307-cf437a8930b2',
  '569eafb9-ebe1-45af-a307-cf437a8930b2',
  '569eafb9-ebe1-45af-a307-cf437a8930b2',
  jsonb_build_object('sub', '569eafb9-ebe1-45af-a307-cf437a8930b2', 'email', 'uji.coba@presensia.test'),
  'email', now(), now(), now()
) on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.institutions (id, name, institution_type, city, is_active)
values ('5748b006-4c7d-4f05-a6d9-bc5a5e64a5ae', '[UJI] SMK Test', 'SMK', 'Serang', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.profiles (id, role, full_name, email, is_active)
values ('569eafb9-ebe1-45af-a307-cf437a8930b2', 'participant', '[UJI] Coba', 'uji.coba@presensia.test', true)
on conflict (id) do update set role = excluded.role, is_active = true;

insert into public.internships (
  participant_id, institution_id, participant_type, student_number, major,
  start_date, end_date, is_active
) values (
  '569eafb9-ebe1-45af-a307-cf437a8930b2',
  '5748b006-4c7d-4f05-a6d9-bc5a5e64a5ae',
  'SMK_PKL', '[UJI]-001', 'Uji Coba',
  '2026-09-01', '2026-12-31', true
);
