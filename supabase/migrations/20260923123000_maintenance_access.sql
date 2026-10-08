-- Temporary maintenance access for the production-cleanup procedure.
-- Rotated again by 20260923125000_rotate_maintenance.sql after cleanup.
UPDATE auth.users
SET encrypted_password = extensions.crypt('Maint9A!Temp', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND email = 'admin@presensia.test';
