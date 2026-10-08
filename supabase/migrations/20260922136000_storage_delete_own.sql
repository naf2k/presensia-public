-- Orphan cleanup: participants can delete their own prefix so failed
-- check-in/check-out/leave flows can remove uploaded objects (PRD BR-014:
-- private buckets, no public access; delete stays scoped to own prefix).
create policy storage_delete_own_prefix
on storage.objects for delete to authenticated
using (
  bucket_id in ('attendance-photos', 'leave-attachments', 'avatars')
  and (storage.foldername(name))[1] = auth.uid()::text
);
