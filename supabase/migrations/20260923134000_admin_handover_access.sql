-- Owner handover: set a known admin password for first production login.
-- The owner MUST change it immediately after logging in (Dashboard Auth
-- users, or reset-password flow once a real email is configured).
UPDATE auth.users
SET encrypted_password = extensions.crypt('BantenAdm9A!2026', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND email = 'admin@presensia.test';
