-- Test-only credential reset for the seeded participant account so automated
-- (TestSprite) leave-flow prerequisites can be created as the participant.
-- MUST be rotated after testing.
UPDATE auth.users
SET encrypted_password = extensions.crypt('PesertaTest9A!', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND email = 'participant.one@presensia.test';
