-- Admin kedua untuk operasional (diminta owner 2026-09-27).
-- Password awal diset langsung (hash bcrypt); pemilik wajib mengganti
-- setelah login pertama via Alur Lupa Kata Sandi.

do $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'presensia.diskominfo@gmail.com';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated', 'authenticated', v_email,
    extensions.crypt('Presensia@diskominfo2026', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Presensia"}'::jsonb,
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_id, v_id, v_id,
    jsonb_build_object('sub', v_id, 'email', v_email),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, role, full_name, email, is_active)
  values (v_id, 'admin', 'Admin Presensia', v_email, true);
end;
$$;
