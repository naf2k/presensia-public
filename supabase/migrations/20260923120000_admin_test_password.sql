-- Test-only credential reset for the seeded admin account used by
-- automated (TestSprite) and manual smoke tests.
-- PRD §27: no public registration; this only rotates a known secret on an
-- existing seeded admin. MUST be rotated via Dashboard/recovery after testing.
UPDATE auth.users
SET encrypted_password = extensions.crypt('AdminTest9A!', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND email = 'admin@presensia.test';
