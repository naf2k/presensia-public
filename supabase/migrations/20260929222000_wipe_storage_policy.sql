-- Tahap 1 wipe total: kebijakan hapus storage sementara untuk admin.
-- Latar: policy storage_delete_own_prefix hanya mengizinkan hapus file milik
-- sendiri; pengosongan bucket pra-wipe butuh hak admin via Storage API.
-- Kebijakan ini DICABUT kembali di migrasi 20260929223000_full_wipe.
-- Backup: docs/release/backup-wipe-20260929/ (lokal, tidak di-commit).
create policy storage_admin_wipe_all
on storage.objects for delete to authenticated
using (
  bucket_id in ('attendance-photos', 'leave-attachments', 'avatars')
  and (select public.is_admin())
);
