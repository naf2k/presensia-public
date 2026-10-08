# Presensia — Platform Presensi & Monitoring PKL/Magang

> **Hadir. Tercatat. Terpantau.** — Built during my AI Engineer internship at Diskominfo Provinsi Banten. In production with 47 active participants.

Attendance & monitoring platform for internship (PKL/magang) programs: admin web for managers, mobile app for participants, Supabase backend with strict server-side verification.

## What it does

- **Participant mobile (Expo):** mandatory selfie check-in + GPS radius check (150 m) + server time (Asia/Jakarta); automatic Hadir/Terlambat status with late minutes; optional check-out photo; journals; history; leave/sick requests with attachments.
- **Admin web (Next.js, 14 routes):** today dashboard + attention items, participant CRUD + Excel import, attendance filters + reasoned corrections, journals, leave approval, CSV/XLSX/PDF reports, schedule/location/tolerance settings, append-only audit log.
- **Anti-fraud by design:** QR is used only for app distribution, not for attendance. Selfie, GPS, and server time are all verified server-side.

## Stack

- Monorepo: pnpm + Turborepo
- Admin: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui, TanStack Query v5, React Hook Form, Zod
- Mobile: Expo SDK 57, Expo Router, React Native, NativeWind
- Backend: Supabase (Postgres, Auth, private Storage, RLS, Edge Functions)
- 60+ migrations, 12 Edge Functions (check-in, check-out, leave review, admin correction)

## Repo layout

```text
apps/admin        # Next.js App Router — Web Admin
apps/mobile       # Expo + Expo Router — Mobile peserta
packages/         # shared types, validation, constants, utils
supabase/         # migrations + edge functions
docs/             # setup, tech-stack, conventions, release notes
brand/            # logo & icon assets
PRD_Presensia_v1.0.md  # full product spec (20 FR, 16 BR, 14 SEC)
```

## Run locally

```bash
pnpm install
pnpm dev:admin     # http://localhost:3000
pnpm dev:mobile    # Expo bundler + QR
```

Health checks:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Environment

Copy the `.env.example` files and point them at your own Supabase staging project. Never commit secrets. The destructive cloud-test script refuses to run against production unless explicitly allowed.

## Note

This is a sanitized public snapshot of an internal project — production URLs, credentials, participant photos, and test data have been removed. Full git history is intentionally not published.
