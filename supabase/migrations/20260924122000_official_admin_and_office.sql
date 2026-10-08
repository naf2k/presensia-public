-- Fase 1: official office coordinates + official admin account.
-- Owner-supplied on 2026-09-24: office (-6.162464, 106.142273),
-- admin email admin@presensia.com.
-- The temporary password below MUST be changed by the owner immediately
-- after first login (admin reset-password page). It is single-use for
-- handover only.

-- 1. Official admin auth user (temporary handover password).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '96327354-287f-4f3d-85b4-7215458077c7',
  'authenticated', 'authenticated', 'admin@presensia.com',
  extensions.crypt('Yq4wGCkHMdG0efoY', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Admin Presensia"}'::jsonb,
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
  '96327354-287f-4f3d-85b4-7215458077c7',
  '96327354-287f-4f3d-85b4-7215458077c7',
  '96327354-287f-4f3d-85b4-7215458077c7',
  jsonb_build_object('sub', '96327354-287f-4f3d-85b4-7215458077c7', 'email', 'admin@presensia.com'),
  'email', now(), now(), now()
) on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, role, full_name, email, is_active)
values ('96327354-287f-4f3d-85b4-7215458077c7', 'admin', 'Admin Presensia', 'admin@presensia.com', true)
on conflict (id) do update set role = 'admin', email = excluded.email, is_active = true;

-- 2. Official office location (replaces "Lokasi Fiktif Pengujian").
update public.attendance_settings
set location_name = 'Kantor Diskominfo Provinsi Banten',
    latitude = -6.162464,
    longitude = 106.142273,
    updated_by = '96327354-287f-4f3d-85b4-7215458077c7',
    updated_at = now();

insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data, reason)
values (
  '96327354-287f-4f3d-85b4-7215458077c7',
  'SETTINGS_UPDATED', 'attendance_settings', 'official-office',
  jsonb_build_object('location_name', 'Kantor Diskominfo Provinsi Banten', 'latitude', -6.162464, 'longitude', 106.142273),
  'Official office coordinates supplied by owner; replaces fictitious test location.'
);

-- 3. Retire the .test handover admin (known password, test identity).
delete from public.profiles
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

delete from auth.identities
where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

delete from auth.users
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
