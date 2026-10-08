# Setup — Presensia foundation

Prasyarat: Node.js 20+ (disarankan 22 via `.nvmrc`), pnpm 9+, Git.
Opsional: Supabase CLI, akun Expo/EAS untuk build mobile nanti.

## Install

```bash
pnpm install
```

## Jalankan Web Admin

```bash
pnpm dev:admin
# http://localhost:3000
```

## Jalankan Mobile (Expo)

```bash
pnpm dev:mobile
# scan QR dengan Expo Go, atau tekan w/a untuk emulator/web
```

## Cek kesehatan

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Environment

Salin `.env.example` ke file env lokal dan isi tanpa commit secret (PRD SEC-005):

- `apps/admin/.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `apps/mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Troubleshooting

- `ERR_PNPM_IGNORED_BUILDS`: build script `sharp`/`unrs-resolver` sudah diizinkan di
  `pnpm-workspace.yaml` (`allowBuilds`). Jika paket baru meminta approval, jalankan
  `pnpm approve-builds`.
- Node 26: berjalan, tetapi CI/Vercel/EAS dipatok Node 22 (`.nvmrc`).
- Tailwind web v4 vs mobile v3: konfigurasi terpisah (`apps/admin` PostCSS,
  `apps/mobile` NativeWind v4 + `tailwind.config.js`).
- Port 3000 dipakai: `pnpm --filter @presensia/admin dev -- --port 3001`.
