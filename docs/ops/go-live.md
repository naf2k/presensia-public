# Go-Live Checklist — Presensia

Pemilik: tim Diskominfo + owner repo. Status kode: hijau (typecheck/lint/build),
migrasi sinkron ke Cloud, drill end-to-end lulus. Yang di bawah ini tindakan
manusia — bukan kode.

## 1. Push & deploy (owner repo)

- [x] Push branch `bakekujira` ke remote (selesai 2026-09-25: `github.com/naf2k/presensia`, privat).
- [ ] Tunggu deploy Vercel `presensia-admin` hijau; buka dan login admin.
- [ ] `eas build --platform android --profile preview`; pastikan
      `EXPO_PUBLIC_SUPABASE_ANON_KEY` tetap terisi di EAS secrets.

## 2. Data awal nyata (admin, via UI)

- [ ] Tambah institusi pertama di `/institusi` (pengganti prosedur SQL lama).
- [ ] Tambah peserta pertama di `/peserta/tambah` (undangan via mailer bawaan).
- [ ] Cek peserta muncul di dashboard dan daftar.

## 3. Smoke test di kantor (HP peserta + web admin)

- [ ] Scan QR final (`/install`) dari HP Android → download APK → install → login.
- [ ] Scan QR final dari iPhone → buka di Expo Go → login.
- [ ] Check-in dari dalam radius → status benar (Hadir/TERLAMBAT), jam = jam server.
- [ ] Isi jurnal → terlihat di `/jurnal` admin beserta riwayat revisi.
- [ ] Check-out (foto wajib) → jam pulang terisi.
- [ ] Ajukan izin → setujui/tolak dari `/izin-sakit` → audit tercatat.
- [ ] Buka foto presensi + lampiran dari admin (signed URL).
- [ ] Cek `/laporan`: filter, preview, export CSV + XLSX.

## 4. Akun & email (Dashboard Supabase)

- [ ] Ganti email admin ke alamat dinas asli (Auth → Users).
- [ ] Uji "Lupa kata sandi" end-to-end sampai inbox dinas.
- [ ] (Opsional, dianjurkan) Isi SMTP kustom di Project Settings → Auth.

## 5. Operasional berjalan

- [ ] Aktifkan backup/PITR sesuai tier; lakukan restore drill sekali.
- [ ] Review rate limits, SSL enforcement, network restrictions.
- [ ] Konfirmasi angka operasional di `/pengaturan`: Senin–Kamis,
      masuk 07:30 +15 mnt, pulang 16:00, radius 150 m, foto checkout wajib.
- [ ] iOS: butuh Apple Developer (tanpa itu, iPhone via Expo Go).

## Catatan yang disengaja

- Jadwal otomatis: absence Senin–Kamis 17:05 WIB, prune `operation_log` >90 hari
  17:15 WIB (pg_cron, mengikuti pola yang sudah ada).
- Penghapusan butuh migrasi (API sengaja tidak bisa hapus bukti).
- Perubahan institusi tidak masuk audit log (backend belum menyediakan jalurnya).
- `supabase test db` butuh Docker lokal yang sehat (disk + containerd saat ini rusak).
