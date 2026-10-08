# Release Report — Presensia v0.1.0

Tanggal rilis: 23 September 2026. Referensi: `PRD_Presensia_v1.0.md`.
Status: **rilis bertahap — Web Admin + backend production LIVE; mobile Android
build dalam progres; iOS menunggu Apple Developer.**

## Deployed version

| Item | Detail |
|---|---|
| Versi aplikasi | 0.1.0 (`apps/admin`, `apps/mobile`, EAS `preview`) |
| Commit rilis | `9946b81` + perubahan rilis (migrasi, `eas.json`, `app.json` projectId, `apps/admin/.gitignore`) |
| Environment | Production (satu project Supabase untuk semua env — keputusan pemilik) |
| Migrasi | 20 file `...30000`–`...131500`, semua sinkron (`supabase migration list` 20/20) |

## Deployed services

| Service | Detail |
|---|---|
| Web Admin | `https://presensia-admin.vercel.app` (Vercel project `presensia-admin`, Root Directory `apps/admin`, framework Next.js, Node 22.x, region `sin1`, HTTPS valid, Vercel Authentication dimatikan agar publik) |
| Env Vercel (Production) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL=https://presensia-admin.vercel.app`, `NEXT_PUBLIC_APP_TIMEZONE=Asia/Jakarta` |
| Backend | Supabase Cloud `YOUR_PROD_PROJECT_REF` (Singapore): 9 Edge Functions versi terbaru, Storage policies, RLS, auth (`DISABLE_SIGNUP`, provider email aktif) |
| Mobile | EAS project `@nafi-bussiness/presensia-mobile` (`823e20f7-...`); secret `EXPO_PUBLIC_SUPABASE_ANON_KEY` di EAS; Android build `e1f89b27-...` (status di bawah) |

## Database produksi

- Backup pra-rilis: `docs/release/backup-*.json` (8 tabel, data fiktif).
- Pembersihan: seluruh data fiktif dihapus via migrasi (`..._prod_cleanup`, file Storage via API, kebijakan hapus admin sementara yang sudah dicabut lagi). Status akhir: `profiles: 1` (admin), `institutions/internships/attendance/journals/leaves/audits: 0`, bucket Storage kosong, settings singleton utuh.
- Seed dev (`seed.sql`) tidak pernah dijalankan ke produksi; `backend:deploy` memakai `--include-seed` — **jangan jalankan script itu ke produksi** (catatan proses).
- Gap diketahui: belum ada UI kelola institusi — institusi produksi wajib diinsert via SQL sebelum onboarding peserta (contoh di bawah).

```sql
insert into public.institutions (name, institution_type, city, is_active)
values ('SMK Negeri 1 Contoh', 'SMK', 'Kota Serang', true);
```

## Smoke test result (production)

### Admin (UI produksi via Chromium + API)

| Uji | Hasil |
|---|---|
| Login page render + HTTPS | OK (200, `<title>Presensia Admin`) |
| Login → dashboard → summary card → peserta → audit-log | OK (Playwright: semua assertion lulus) |
| Dashboard/kehadiran/jurnal/izin/laporan/pengaturan/audit | OK (46/46 TestSprite pada build identik pre-rilis) |
| Foto privat via signed URL | OK (`create-signed-url` → 200 `image/png`) |

### Participant (drill SMOKE, data sudah dibersihkan lagi)

| Uji | Hasil |
|---|---|
| Login, konteks profil, tanggal server | OK |
| Simpan jurnal | OK |
| Pengajuan izin → admin reject → audit `LEAVE_REJECTED` | OK |
| Check-in di luar radius → `LOCATION_OUTSIDE_RADIUS` (validasi GPS live) | OK |
| Orphan foto dihapus pemilik (200) | OK |

### Backend (produksi, pasca-pembersihan)

| Uji | Hasil |
|---|---|
| Tanpa token (REST) | 200 + body kosong (RLS menyaring) |
| Participant insert/update attendance langsung | 403 |
| Participant memanggil Edge Function admin | 403 `ADMIN_REQUIRED` |
| Participant membaca profil/foto milik peserta lain | `[]` / 403 |
| Payload invalid | `INVALID_LATITUDE` tanpa efek samping |
| Signup publik | `422 signup_disabled`; login tetap 200 |

## Mobile builds

| Platform | Status |
|---|---|
| Android (APK internal, profile `preview`) | **Selesai** — build `e1f89b27-...` finished 23 Sep 2026 15:36 WIB; artefak terunduh (verifikasi byte awal 200/206): `https://expo.dev/artifacts/eas/q2NjlDnXHak6bcqFjCvGl2-3OfDGPqRyBvHor0WuskY.apk` |
| iOS | **Tertunda**: butuh kredensial Apple Developer (`Failed to set up credentials` pada `eas build --platform ios`). Tanpa ini iOS hanya via Expo Go. Juga perlu `ios.infoPlist.ITSAppUsesNonExemptEncryption` sebelum TestFlight |

## Known issues (non-blocker)

1. Paginasi list admin client-side di bawah `max_rows=1000` — aman untuk skala MVP.
2. Fixture foto seed 1×1 px (pengujian visual) — tidak memengaruhi produksi.
3. `supabase test db` (pgTAP) butuh DB lokal — diganti matriks API langsung.
4. Email recovery: provider menolak alamat `.test` (`email_address_invalid`) — wajar karena domain itu tak terkirim. Akun admin produksi **wajib diganti ke email dinas asli** via Dashboard, baru uji recovery end-to-end. Rantai kode + API terverifikasi (request sampai ke provider).
5. Tidak ada UI kelola institusi (lihat prosedur SQL di atas).
6. Tidak ada store listing/publish — sesuai keputusan (internal saja).

## Rollback procedure

- **Web**: `vercel rollback` ke deployment sehat sebelumnya (atau redeploy commit stabil).
- **Database**: migrasi bersifat aditif kecuali cleanup; untuk rollback data, restore dari `docs/release/backup-*.json` (data fiktif pra-rilis) atau snapshot dashboard Supabase. Migrasi password tidak dapat di-rollback (hash acak) — gunakan Dashboard Auth untuk set ulang akses admin.
- **Mobile**: build EAS bersifat aditif; tetap distribusikan build terakhir yang lolos smoke.
- Kriteria hentikan rilis: smoke test kritis gagal (login, check-in, RLS bocor) → rollback + catat di sini.
