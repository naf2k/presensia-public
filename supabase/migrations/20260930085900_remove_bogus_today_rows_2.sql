-- Susulan 2026-09-30 08:59 WIB: 4 baris bogus baru muncul SETELAH wipe 08:08
-- (dibuat 08:37-08:49 oleh akun SMKN 1 Bayah + akun utama saat utak-atik
-- pengaturan). Guard sama: hanya baris TANPA check-in yang dihapus.
-- Snapshot: docs/release/backup-wipe-20260929/bogus-2026-09-30-b.json (lokal).
delete from public.attendance_records
where attendance_date = '2026-09-30'
  and check_in_at is null;
