-- End of release: invalidate the temporary release smoke-test password.
-- Admin access afterwards only via Supabase Dashboard (Auth users) or the
-- recovery flow (requires the production URL allow-listed in Auth settings).
UPDATE auth.users
SET encrypted_password = extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND email = 'admin@presensia.test';
