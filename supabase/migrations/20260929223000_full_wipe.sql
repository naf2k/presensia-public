-- Tahap 2 wipe total: kosongkan SELURUH data operasional production.
-- Yang DIPERTAHANKAN: akun admin (profiles role='admin' + auth-nya),
-- attendance_settings (titik kantor + jadwal), holiday_calendar (libur nasional).
-- Yang DIHAPUS: audit_logs, attendance_records, journals, leave_requests,
-- internships, profiles non-admin, institutions, akun auth non-admin.
-- Storage sudah dikosongkan via API (policy sementara dicabut di bawah).
-- Backup: docs/release/backup-wipe-20260929/ (lokal, tidak di-commit).
-- PERMANEN dan tidak bisa dibatalkan kecuali dari backup.

-- 1. Jejak audit + log operasi server (disetujui dihapus; keduanya leaf).
delete from public.audit_logs;
delete from public.operation_log;

-- 2. Data transaksional peserta, urutan aman FK RESTRICT:
-- journals -> internships & attendance_records; attendance_records -> leave_requests.
delete from public.journals;
-- journal_revisions ikut terhapus via ON DELETE CASCADE dari journals.
delete from public.attendance_records;
delete from public.leave_requests;
delete from public.internships;

-- 3. Profil non-admin (2 profil admin dipertahankan agar is_admin() tetap jalan).
delete from public.profiles where role <> 'admin';

-- 4. Institusi (disetujui: hapus semua).
delete from public.institutions;

-- 5. Akun auth yang profilnya sudah tidak ada (tepat: hanya non-admin).
delete from auth.identities where user_id not in (select id from public.profiles);
delete from auth.users where id not in (select id from public.profiles);

-- 6. Cabut kebijakan hapus storage sementara dari tahap 1.
drop policy if exists storage_admin_wipe_all on storage.objects;
