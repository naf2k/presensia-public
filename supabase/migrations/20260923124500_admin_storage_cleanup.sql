-- Temporary least-privilege grant for the production-cleanup procedure:
-- lets an active admin delete Storage objects via the API so orphaned test
-- files can be removed. Dropped again by 20260923125500_drop_admin_storage_cleanup.sql.
create policy storage_admin_delete
on storage.objects for delete to authenticated
using ((select public.is_admin()));
