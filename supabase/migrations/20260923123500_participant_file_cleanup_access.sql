-- Temporary access for the file-cleanup step of the production-cleanup
-- procedure: lets the owning test participant delete its own Storage prefix
-- via the API (policy storage_delete_own_prefix). The account itself is
-- removed by 20260923124000_prod_cleanup.sql.
UPDATE auth.users
SET encrypted_password = extensions.crypt('Clean9A!Files', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND email = 'participant.one@presensia.test';
