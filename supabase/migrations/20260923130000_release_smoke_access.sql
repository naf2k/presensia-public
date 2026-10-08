-- Temporary access for release smoke tests (admin + one participant).
-- The participant row is created by this migration as a real onboarding
-- drill, then both passwords are rotated by ..._131000. Remove this file's
-- approach after release; use Dashboard for access management.
UPDATE auth.users
SET encrypted_password = extensions.crypt('Relsmok9A!Adm', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND email = 'admin@presensia.test';
