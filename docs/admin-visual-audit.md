# Admin Visual Audit

Tanggal audit: 23 September 2026

## Scope

- Live deployment: `https://presensia-admin.vercel.app/`
- Target: web admin Next.js
- Baseline: `prototype/admin/*.html`, `prototype/shared/styles/*.css`
- Authentication: admin test account supplied by user
- Viewport observed: desktop Chrome, 1440 x 778 browser window

## Route Parity

| Prototype | Next.js route | Status |
| --- | --- | --- |
| `login.html` | `/login` | Present |
| `index.html` | `/` | Present |
| `peserta.html` | `/peserta` | Present |
| `peserta-tambah.html` | `/peserta/tambah` | Present |
| `peserta-detail.html` | `/peserta/[id]` | Present |
| `peserta-edit.html` | `/peserta/[id]/edit` | Present |
| `kehadiran.html` | `/kehadiran` | Present |
| `kehadiran-detail.html` | `/kehadiran/[id]` | Present |
| `jurnal.html` | `/jurnal` | Present |
| `izin-sakit.html` | `/izin-sakit` | Present |
| `laporan.html` | `/laporan` | Present |
| `pengaturan.html` | `/pengaturan` | Present |
| `audit-log.html` | `/audit-log` | Present |

Additional Next.js route: `/reset-password`.

## Findings

### P0

None observed.

### P1

None observed in authenticated dashboard and participant list.

Observed live dashboard matches prototype visual language:

- Plus Jakarta Sans typography
- Terracotta primary, sage status colors, warm off-white background
- Dark fixed sidebar with active navigation state
- Sticky topbar with search, notification, and profile controls
- Summary metric strip
- Attendance table and attention panel
- Card radius, borders, shadows, and spacing
- Responsive CSS breakpoints are shared from prototype structure

### P2

None requiring source changes. Live data differs from prototype fixture data, but this is expected and not a visual mismatch.

### Authenticated Detail State

The live participant detail route was checked with an invalid ID. It rendered the designed error state:

- `Detail peserta` heading
- `Gagal memuat data` message
- `Coba lagi` action
- participant ID context
- shared admin shell and navigation

No broken blank state or unstyled error page observed.

## Live Data Difference

Deployment currently contains one smoke-test participant:

- `SMOKE Drill`
- `SMOKE Drill School`
- `Lokasi Fiktif Pengujian`

Prototype contains presentation fixtures such as Ahmad Naufal, Nadia Safitri, and Rizky Fadillah. Do not replace live data with prototype fixtures as part of visual synchronization.

## Verification

```text
pnpm --filter @presensia/admin typecheck  PASS
pnpm --filter @presensia/admin lint       PASS
pnpm --filter @presensia/admin build      PASS
```

## Source Parity

- `apps/admin/src/styles/admin.css` contains prototype admin styles plus styles for internal Next.js pages.
- The shared token files match semantically; differences are formatting only.
- Live public route checks returned HTTP 200 for all primary routes.
- The Impeccable mechanical detector returned no findings for audited UI files.
- `typecheck`, `lint`, and `build` pass after this audit pass.

## Decision

Font parity fix applied after visual review found lighter live text than prototype. Next.js now loads the same Plus Jakarta Sans weights as the prototype: 400, 500, 600, 700, and 800. The font variable also uses a separate name to avoid self-referential `--font-sans` resolution.

Residual risk: pixel-level comparison at tablet/mobile viewport and valid-data detail states still needs dedicated screenshot automation. Deployment must be rebuilt after this font fix before live visual verification.

## Pass Eksekusi Paritas (Build Mode)

Tanggal: 23 September 2026 (sesi lanjutan, uncommitted working tree).

### Metode

- 11 screenshot Desktop (deployment lama, viewport 1440) dibaca ulang sebagai bukti render.
- Perbandingan kode sistematis: 13 file `prototype/admin/*.html` vs 14 route Next.js.
- Verifikasi CSS otomatis: seluruh 468 blok `prototype/admin/styles.css` identik di `apps/admin/src/styles/admin.css`; `components.css` 16/16 identik; `tokens.css` hanya berbeda pada `:root` font stack (fix yang disengaja).
- `typecheck`, `eslint .`, dan `next build` dijalankan ulang hingga hijau.

### Temuan Baru dan Perbaikan

| # | Temuan | Status |
| --- | --- | --- |
| 1 | `pnpm lint` ikut me-lint artefak `.vercel/output` (58 error di luar `src`) karena `eslint.config.mjs` meng-override ignore bawaan Next tanpa `.vercel/**` | Diperbaiki: `.vercel/**` ditambah ke `globalIgnores` |
| 2 | `button.nav-item` (Keluar) dan `button.menu-button` (hamburger mobile) tanpa reset UA → chrome bawaan browser, prototype memakai `<a>`/`<label>` | Diperbaiki: reset di `globals.css` |
| 3 | Subtitle preview laporan memakai tanggal ISO mentah (`2026-09-01 sampai ...`), prototype memakai rentang `01–23 September 2026 · N peserta · M catatan` | Diperbaiki: `rangeLabel` id-ID + hitung peserta distinct |
| 4 | Kolom foto tabel kehadiran, label ringkasan, subtitle tanggal ganda, hint foto ganda, ikon Lucide, footer ganda dashboard, overlay `.photo-meta`, preview 1000 baris, badge jurnal, periode detail | Sudah diperbaiki pada pass sebelumnya, terverifikasi masih ada di tree |

### Pengecualian Disengaja (Visual Sama, Fungsi Tetap)

- `/reset-password`: tanpa prototype, diturunkan dari sistem visual login.
- Baris `Batas akurasi GPS` di pengaturan: fitur fungsional, memakai token yang sama.
- Upload foto edit peserta: disembunyikan dalam `<details>` collapsed agar tinggi default mendekati prototype.
- Preview laporan 5 baris; export tetap seluruh hasil filter.
- Deep-link `?status=` kehadiran didukung via `useSearchParams`.
- State loading/error/empty memakai token prototype; tidak ada padanan HTML-nya.

### Verifikasi Akhir

```text
pnpm --filter @presensia/admin typecheck  PASS
pnpm --filter @presensia/admin lint       PASS (termasuk .vercel ignore fix)
pnpm --filter @presensia/admin build      PASS (14/14 route)
```

Catatan: screenshot Desktop yang ada mendahului working tree, sehingga verdeployment ulang diperlukan untuk bukti visual final. Halaman detail peserta/edit, detail kehadiran, dan audit log belum memiliki screenshot — paritasnya diverifikasi lewat perbandingan kode dan dinyatakan sesuai struktur.

## Pass Screenshot Production (23 September 2026, malam)

Deployment: `presensia-admin-gd4wuw3dw-equine-store.vercel.app` (commit `3270d0a`).
Metode: Chrome headless 1440×778 via CDP, login akun admin production, 14 route aplikasi
(`/tmp/shots-app/`) vs 13 halaman prototype statis (`/tmp/shots-proto/`).

Hasil perbandingan visual:

| Route | Hasil |
| --- | --- |
| `/login` | Identik pixel dengan prototype |
| `/` (dashboard) | Sesuai (data production minim: 1 peserta SMOKE Drill, selebihnya nol) |
| `/peserta` | Sesuai setelah default filter status → `Aktif` (commit `3270d0a`) |
| `/peserta/tambah` | Identik |
| `/peserta/[id]` | Sesuai (stat strip, tab hitungan, riwayat, jurnal terbaru) |
| `/peserta/[id]/edit` | Sesuai; subtitle kini `Terakhir diperbarui {tanggal}.` dari `updated_at` |
| `/kehadiran` | Sesuai; empty state dalam token prototype (production tanpa presensi hari ini) |
| `/kehadiran/[id]` | Tidak dapat diuji populated (nol catatan di production); error state ID invalid terverifikasi dalam token |
| `/jurnal`, `/izin-sakit`, `/laporan`, `/pengaturan`, `/audit-log` | Sesuai; empty state dalam token; subtitle laporan `01–23 September 2026 · N peserta · M catatan` sesuai format prototype |
| `/reset-password` | Render bersih dalam sistem visual login (tanpa prototype) |

Perbaikan dari temuan screenshot (commit `3270d0a`):

- Default filter status peserta `all` → `active` (samakan tampilan awal prototype).
- Subtitle topbar izin-sakit statis → dinamis `{n} pengajuan menunggu` (fallback `Pengajuan peserta` saat nol).
- Subtitle form edit generik → `Terakhir diperbarui {tanggal}.` bila `updatedAt` tersedia.

Verifikasi akhir: `typecheck` PASS, `eslint .` PASS, `next build` PASS via `vercel --prod` (42 dtk).
Bukti screenshot tersimpan di `/tmp/shots-app/` dan `/tmp/shots-proto/` pada mesin QA.

## Pass Final (24 September 2026)

Lihat laporan acceptance: `docs/admin-final-acceptance.md`.
Bukti desktop permanen: `docs/qa-evidence/desktop/*.png` (14 route, fixture deterministik).
Deployment final: `presensia-admin-monp7ls1d-equine-store.vercel.app` (commit `fa2214d`).
Production smoke (login + 7 route, read-only): PASS. Tidak ada mutasi backend production.
