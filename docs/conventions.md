# Konvensi — Presensia foundation

- Bahasa UI: Bahasa Indonesia.
- Import lintas app selalu dari `@presensia/*`, bukan relative path ke `packages/`.
- `packages/*` hanya berisi type/enum/konstanta/skema/util murni. Tidak ada fetch,
  tidak ada akses Supabase, tidak ada aturan bisnis yang ditegakkan di sini —
  backend adalah sumber kebenaran (PRD BR-002/BR-007).
- Zona waktu operasional: `Asia/Jakarta` (PRD BR-015). Database menyimpan
  `timestamptz`/UTC pada tahap backend; format WIB hanya di presentation layer.
- Warna primer bukan biru (PRD §21.1). Token di `@presensia/constants` (`COLOR_TOKENS`)
  adalah single source of truth; theme web (`globals.css`) dan mobile
  (`tailwind.config.js`) mencerminkannya.
- Secret tidak pernah di-commit (PRD SEC-005). Contoh env hanya di `*.example`.
- `prototype/` adalah arsip HTML statis — jangan diimpor oleh `apps/*`.
