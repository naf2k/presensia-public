-- Post-test rotation: replace known test passwords with random values so the
-- seeded admin/participant accounts can no longer be accessed with test
-- credentials. Mirrors the approach in supabase/seed.sql. To grant access
-- again, use Supabase Dashboard (Auth users) or the recovery flow.
UPDATE auth.users
SET encrypted_password = extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
    updated_at = now()
WHERE id IN (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);
