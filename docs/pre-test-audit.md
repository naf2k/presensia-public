# Pre-Test Audit — Presensia (sebelum TestSprite)

Tanggal: 23 September 2026. Referensi: `PRD_Presensia_v1.0.md`.
Ruang lingkup: `apps/admin`, `apps/mobile`, `supabase/` (migrasi, RLS, Storage, Edge Functions), konfigurasi repo.
Keputusan pengguna: file orphan dihapus otomatis; signup publik mati total; laporan mengikuti PRD.

## Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` (6 paket) | Lulus |
| `pnpm typecheck` (10 tugas) | Lulus |
| `pnpm build` (admin 14 halaman, mobile 18 route) | Lulus |
| `git diff --check` | Bersih |
| `supabase migration list` | 7/7 migrasi sinkron ke Cloud (`...30000`–`...36000`) |
| `supabase db push` | Migrasi `20260922136000_storage_delete_own.sql` teraplikasi |
| `supabase config push` | `[auth.email] enable_signup` → `false` terpush |
| `supabase functions deploy create-signed-url` | Terdeploy ke `YOUR_PROD_PROJECT_REF` |
| `supabase test db` | Tidak dapat jalan — tidak ada database lokal (lihat catatan) |

## Temuan dan status

| # | Issue | Severity | Solusi | Status |
|---|---|---|---|---|
| 1 | Form login admin `action="/login" method="get"` + `name="password"` — password bisa bocor ke URL bila JS gagal (`apps/admin/src/app/login/page.tsx`) | Critical | Hapus `action/method`, hapus `name` pada email/password/remember; submit hanya via `onSubmit` | Selesai |
| 2 | File orphan di Storage privat saat validasi backend gagal (upload dulu, RPC/insert belakangan) (`apps/mobile/src/api.ts`) | High | Hapus kompensasi otomatis: `removeAsset()` best-effort pada `checkIn/checkOut/submitLeave` saat lanjutan gagal | Selesai |
| 3 | Client tidak punya izin hapus sehingga cleanup orphan tak bisa jalan (hanya policy `INSERT`/`SELECT` Storage) | High | Migrasi baru `20260922136000_storage_delete_own.sql`: policy `DELETE` prefix milik sendiri untuk 3 bucket; sudah di-push | Selesai |
| 4 | Signup email terbuka (`[auth.email] enable_signup = true`) padahal PRD §27.1/FR-012: tanpa registrasi publik | High | Investigasi: menonaktifkan flag email ikut mematikan *login* email (`email_provider_disabled`), jadi provider tetap aktif dan registrasi publik diblokir oleh top-level `[auth] enable_signup = false` (GOTRUE_DISABLE_SIGNUP). Terverifikasi: login 200, signup `422 signup_disabled` | Selesai, terverifikasi |
| 5 | Listener auth admin hanya menangani `TOKEN_REFRESHED`/`SIGNED_OUT`; event `SIGNED_IN`/`USER_UPDATED` (mis. reset-password) tak re-validasi role (`apps/admin/src/lib/auth.tsx`) | High | Tangani `SIGNED_IN`/`USER_UPDATED` dengan `validateAdmin`, sign-out bila bukan admin aktif | Selesai |
| 6 | Listener sesi mobile menelan mentah event apa pun; sesi admin yang tersimpan bisa menetap (`apps/mobile/src/session.tsx`) | High | Re-validasi `participant` aktif pada `SIGNED_IN`, sign-out bila tidak memenuhi | Selesai |
| 7 | Laporan: tanpa validasi `selesai >= mulai`; tombol export aktif saat kosong/gagal (`apps/admin/src/app/laporan/page.tsx`, PRD FR-017/AC-009) | High | Validasi rentang + toast ramah; export disabled saat pending/error/kosong dengan guard ganda | Selesai |
| 8 | `create-signed-url` tanpa normalisasi path (`..`, `/`, `\`) (`supabase/functions/create-signed-url/index.ts`) | Medium | Tolak path mengandung traversal; redeploy | Selesai |
| 9 | Upload tanpa cek ukuran; foto kamera > 1 MiB pasti gagal setelah user bersusah payah (limit bucket `attendance-photos` 1 MiB, PRD FR-009 ukuran dibatasi) | Medium | `uploadAsset()` cek `byteLength` (1 MiB foto presensi, 5 MiB lampiran) → `FILE_TOO_LARGE` ramah sebelum upload | Selesai |
| 10 | Ekstensi lampiran fallback `"bin"` pasti ditolak bucket (`apps/mobile/src/api.ts`) | Medium | Allowlist `jpg/jpeg/png/pdf`, tolak dini dengan `INVALID_FILE_TYPE` ramah | Selesai |
| 11 | Teks hardcoded salah di form edit (`Terakhir diperbarui 18 September 2026 oleh Siti Rahma.`) | Medium | Ganti kalimat generik audit-log | Selesai |
| 12 | `participantIndex()` di-fetch ulang per query (laporan memicu 2× full scan) (`apps/admin/src/lib/admin-api.ts`) | Medium | Cache dalam-memori TTL 15 dtk | Selesai |
| 13 | Komentar basi `dari data mock` (`apps/admin/src/lib/export.ts`) | Low | Perbarui ke data backend PRD FR-017 | Selesai |
| 14 | Form `pengaturan`/`laporan` memakai `action/method="get"` (risiko query-string, inkonsisten) | Low | Hapus, hanya `onSubmit` + `noValidate` | Selesai |

## Diterima untuk MVP (bukan blocker TestSprite)

- **Paginasi semu admin** (`admin-api.ts`): filter + `slice()` di klien di atas `max_rows = 1000`. UI sudah paginasi 20/halaman sesuai PRD §19.2 dan data seed jauh di bawah batas. Skala MVP (puluhan–ratusan peserta) aman; paginasi server penuh dijadwalkan pasca-TestSprite.
- **`fileName` divalidasi tapi tak dipakai** (`admin-upload-avatar`): validasi panjang input, bukan kode mati fungsional; kontrak API tidak diubah sebelum uji.
- **`supabase test db` (pgTAP)**: perlu database lokal yang tidak tersedia; sebagai ganti, migrasi diverifikasi via `migration list` sinkron + `db push` sukses. Uji RLS/storage tercakup dalam smoke test dan TestSprite.
- **`scripts/backend-cloud-test.mjs`**: butuh `SUPABASE_SERVICE_ROLE_KEY` yang tidak disimpan di repo; tidak dijalankan.

## Catatan keamanan (lolos audit)

- RLS aktif semua tabel; tulis `attendance/audit/settings/profiles/internships` dicabut dari `authenticated`; `journals/leaves` insert/update terkekang; Storage privat + insert prefix-sendiri + select sendiri/admin.
- Seluruh Edge Function `verify_jwt = true` + `requireAuth/requireAdmin`; `service_role` hanya di server/functions.
- Tidak ada secret nyata di repo; `.gitignore` menutup `.env*.local`.
- Duplikasi proteksi: `attendance_unique_participant_date`, exclusion overlap izin aktif, `journals_unique_participant_date`, satu internship aktif per peserta, advisory lock check-in.
- Anti double-submit: semua tombol destruktif/mutasi disabled saat pending/loading (login, koreksi, settings, review izin, check-in/out, jurnal, pengajuan izin, export laporan).

## Kesiapan TestSprite

Critical/High: **selesai semua**. Verifikasi hijau kecuali pgTAP lokal (terdokumentasi di atas).
Sisa risiko diketahui: paginasi server penuh dan belum adanya uji upload avatar/approval pending end-to-end (data seed tidak mendukung) — kode dan function sudah tersedia dan terdeploy.
