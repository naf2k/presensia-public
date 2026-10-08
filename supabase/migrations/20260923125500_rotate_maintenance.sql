-- End of release procedure: invalidate the temporary maintenance password so
-- the admin account can only be accessed after a proper password setup via
-- Supabase Dashboard (Auth users) or the recovery flow.
UPDATE auth.users
SET encrypted_password = extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND email = 'admin@presensia.test';
