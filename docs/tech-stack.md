# Tech Stack — Presensia foundation (PRD §24.1)

| Area                   | Stack                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Admin              | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui (new-york), TanStack Query v5, React Hook Form, Zod                                                               |
| Mobile                 | Expo SDK 57, Expo Router (typed routes), React Native 0.86, TypeScript strict, NativeWind v4 (Tailwind v3), TanStack Query v5, React Hook Form, Zod, expo-camera, expo-location, expo-secure-store |
| Shared                 | `@presensia/types`, `@presensia/constants`, `@presensia/validation`, `@presensia/utils` (workspace, source TS)                                                                                     |
| Backend (tahap lanjut) | Supabase: PostgreSQL, Auth, Storage privat, Edge Functions, RLS                                                                                                                                    |
| Tooling                | pnpm workspaces, Turborepo, ESLint flat, Prettier                                                                                                                                                  |

Versi terkunci ada di masing-masing `package.json`. Menambah dependency baru: pasang
dengan `pnpm add --filter <workspace>` agar lockfile root tetap satu.
