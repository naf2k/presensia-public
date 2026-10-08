-- Restore least privilege: drop the temporary admin Storage delete policy
-- introduced by 20260923124500_admin_storage_cleanup.sql now that orphaned
-- test files have been removed via the API.
drop policy if exists storage_admin_delete on storage.objects;
