-- Darurat 2026-09-30 08:08 WIB: hapus baris absensi bogus hari ini yang dibuat
-- prematur oleh akun admin sementara (source ADMIN_CORRECTION, tanpa check-in,
-- tanpa leave_request pendukung) dan memblokir check-in seluruh peserta.
-- Guard: hanya baris TANPA check_in_at yang dihapus; check-in asli aman.
-- Snapshot: docs/release/backup-wipe-20260929/bogus-2026-09-30.json (lokal).
delete from public.attendance_records
where attendance_date = '2026-09-30'
  and check_in_at is null;
