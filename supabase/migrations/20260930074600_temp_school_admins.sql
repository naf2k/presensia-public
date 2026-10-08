-- Akun admin SEMENTARA untuk pengisian data peserta per sekolah (diminta owner
-- 2026-09-30). 7 akun, satu per institusi, password awal sama dan mudah.
-- Email memakai domain .local (tidak untuk surat-menyurat); konfirmasi email
-- dilewati via SQL seperti pola second_admin. "Lupa kata sandi" via email
-- TIDAK berfungsi untuk akun-akun ini; reset via migrasi bila diperlukan.
-- WAJIB DIHAPUS setelah pengisian selesai (cleanup terpisah); data peserta
-- yang mereka input tidak ikut terhapus saat akun dibersihkan.

do $$
declare
  v_pass text := 'Presensia123';
  r record;
begin
  for r in
    values
      ('admin.attaufiqiyyah@presensia.local', 'Admin SMK Attaufiqiyyah'),
      ('admin.smk3serang@presensia.local', 'Admin SMK Negeri 3 Serang'),
      ('admin.nurulhuda@presensia.local', 'Admin SMK Nurul Huda Baros'),
      ('admin.bantenraya@presensia.local', 'Admin SMK Banten Raya Cikulur'),
      ('admin.smk1bayah@presensia.local', 'Admin SMKN 1 Bayah'),
      ('admin.smk1rangkas@presensia.local', 'Admin SMKN 1 Rangkasbitung'),
      ('admin.smk1serang@presensia.local', 'Admin SMKN 1 Serang')
  loop
    declare
      v_id uuid := gen_random_uuid();
    begin
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token,
        email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_id,
        'authenticated', 'authenticated', r.column1,
        extensions.crypt(v_pass, extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', r.column2),
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        v_id, v_id, v_id,
        jsonb_build_object('sub', v_id, 'email', r.column1),
        'email', now(), now(), now()
      );

      insert into public.profiles (id, role, full_name, email, is_active)
      values (v_id, 'admin', r.column2, r.column1, true);
    end;
  end loop;
end;
$$;
