# Admin Final Acceptance — Paritas Visual Frontend

Tanggal: 24 September 2026.
Commit: `fa2214d`.
Deployment production: `https://presensia-admin-monp7ls1d-equine-store.vercel.app` (alias `bakekujira.vercel.app`).

## Scope

Menyamakan frontend admin Next.js (`apps/admin`) dengan prototype statis (`prototype/admin/*.html`)
pada 14 route, 3 viewport, dan 4 state data — tanpa mengubah backend production.

Di luar scope: rotasi kredensial, backup/restore database, recovery email end-to-end via provider,
dan cleanup data production.

## Metode

- Chrome headless via CDP, viewport `1440×778`, `768×1024`, `390×844`.
- Backend production hanya dipakai untuk auth; seluruh data dibaca/ditulis lewat stub
  deterministik (mini-PostgREST + signed-URL foto lokal). Tidak ada mutasi ke production.
- Fixture: 6 peserta (aktif/nonaktif/segera selesai), 22 catatan kehadiran
  (hadir/terlambat/izin/sakit/dikoreksi), 6 jurnal, 6 pengajuan (pending/approved/rejected),
  25 audit log, foto check-in realistis 800×1000.
- Perbandingan 1:1 melawan screenshot prototype pada viewport yang sama.

## Matriks Route × Viewport (populated)

| Route | Desktop | Tablet | Mobile |
| --- | :---: | :---: | :---: |
| `/login` | Identik | Sesuai | Sesuai |
| `/` | Sesuai | Sesuai | Sesuai |
| `/peserta` | Sesuai | Sesuai | Sesuai |
| `/peserta/tambah` | Identik | Sesuai | Sesuai |
| `/peserta/[id]` | Sesuai | Sesuai | Sesuai |
| `/peserta/[id]/edit` | Sesuai | Sesuai | Sesuai |
| `/kehadiran` | Sesuai | Sesuai | Sesuai |
| `/kehadiran/[id]` | Sesuai + foto | Sesuai + foto | Sesuai + foto |
| `/jurnal` | Sesuai | Sesuai | Sesuai |
| `/izin-sakit` | Sesuai | Sesuai | Sesuai |
| `/laporan` | Sesuai | Sesuai | Sesuai |
| `/pengaturan` | Sesuai | Sesuai | Sesuai |
| `/audit-log` | Sesuai | Sesuai | Sesuai |
| `/reset-password` | Sesuai (tanpa prototype) | Sesuai | Sesuai |

Bukti desktop: `docs/qa-evidence/desktop/*.png`.

## Matriks State

| State | Hasil |
| --- | --- |
| Populated | 14/14 route terverifikasi via fixture |
| Empty | Explicit empty state di seluruh tabel + filter tanpa hasil |
| Loading | Skeleton + label "Memuat …" dalam token prototype |
| API error + retry | ErrorState + tombol "Coba lagi" dalam token |
| Validasi form | Field error + toast (tambah peserta, login, reset-password) |
| Invalid ID | Error state + retry (peserta, kehadiran) |
| Foto: ada/tidak/gagal | Render cover + overlay meta, placeholder, error state |

## Sweep Overflow Responsif

13 lebar × 3 route (`/`, `/kehadiran`, `/laporan`): tidak ada page-level horizontal overflow,
kecuali `/kehadiran` pada tepat `1181px` — perilaku ini identik dengan prototype
(toolbar terpotong 13px tepat di atas breakpoint drawer `1180px`), sehingga dipertahankan
sebagai paritas yang disengaja.

## Perbaikan Selama Eksekusi

1. `journals()` kini me-resolve `attendance_id` ke catatan presensi (detail jurnal
   menampilkan tautan `07.51–16.04 · Hadir` seperti prototype).
2. Label status mentah (`HADIR`) pada label kehadiran jurnal → label tampilan (`Hadir`).
3. Kolom WAKTU audit log memakai format ringkas `22 Sep · 09.04` + `WIB` (prototype).
4. Subtitle topbar izin-sakit dinamis, default filter peserta `Aktif`, subtitle laporan
   `DD–DD Month YYYY · N peserta · M catatan`, subtitle edit `Terakhir diperbarui …`.

## Regression

```text
pnpm --filter @presensia/admin typecheck  PASS
pnpm --filter @presensia/admin lint       PASS
pnpm --filter @presensia/admin build      PASS (14/14 route)
vercel --prod                             PASS (38 dtk)
Production smoke (login + 7 route)        PASS
```

## Pengecualian yang Disetujui

- Separator waktu memakai locale id-ID (`08.21`) sedangkan prototype menulis manual (`08:21`).
- Sapaan dashboard mengikuti jam operasional (`Selamat datang` pada malam hari).
- `/reset-password` tanpa prototype, diturunkan dari sistem visual login.
- Baris `Batas akurasi GPS` adalah fitur fungsional dalam token yang sama.
- Upload foto edit disembunyikan dalam `<details>` agar tinggi default mendekati prototype.
- Preview laporan 5 baris; export tetap seluruh hasil filter.

## Pernyataan Selesai

Seluruh 14 route lolos visual QA desktop/tablet/mobile pada state populated/empty/loading/error,
foto realistis tampil benar, tidak ada mutasi backend production selama pengujian,
dan deployment final lolos smoke test. Scope frontend dinyatakan selesai.
