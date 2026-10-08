# Backend Implementation

Backend Presensia menggunakan Supabase Cloud dengan PostgreSQL, Auth, private Storage, Row Level Security, dan Edge Functions. Implementasi ini berdiri sendiri; aplikasi admin dan mobile masih dapat memakai mock sampai tahap integrasi berikutnya.

## Cloud Project

- Project: `Presensia`
- Project ref: `YOUR_PROD_PROJECT_REF`
- Region: Southeast Asia (Singapore)
- Dashboard: <https://supabase.com/dashboard/project/YOUR_PROD_PROJECT_REF>
- Operational timezone: `Asia/Jakarta`

Project ditautkan melalui `supabase link`. File pada `supabase/.temp/` diabaikan Git dan tidak boleh disalin ke repository.

## Security Boundary

- Public registration dinonaktifkan melalui `[auth].enable_signup = false`.
- Email provider tetap aktif agar akun yang dibuat admin dapat login.
- `service_role` hanya digunakan di Edge Functions untuk Auth Admin API dan signed URL setelah authorization eksplisit.
- Browser/mobile menggunakan anon key dan JWT user; service-role key tidak boleh memakai prefix `NEXT_PUBLIC_` atau `EXPO_PUBLIC_`.
- Waktu, tanggal operasional, status hadir/terlambat, jarak, dan menit keterlambatan dihitung server-side.
- Semua bucket private; tidak tersedia permanent public URL.
- Audit log append-only bagi client dan hanya dapat dibaca admin.

## Migrations

| Migration                                     | Tanggung jawab                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `20260922130000_core_schema.sql`              | Enum, delapan entity PRD, FK, unique/check constraints, indexes, timestamp triggers |
| `20260922131000_security_and_storage.sql`     | Auth helpers, RLS, grants, private buckets, storage policies                        |
| `20260922132000_business_operations.sql`      | Check-in/out, leave review, correction, settings, audit transactions                |
| `20260922133000_participant_operations.sql`   | Provisioning dan administrative participant operations                              |
| `20260922134000_harden_integrity.sql`         | Institution/type validation, journal ownership, participant reactivation hardening  |
| `20260922135000_harden_column_privileges.sql` | Column-level write grants and trigger-function privilege hardening                  |

Schema memakai UUID PK dan `timestamptz`. Referential deletion data historis memakai `RESTRICT`; referensi actor/reviewer memakai `SET NULL` agar histori tetap tersedia.

## Data Model

Entity utama:

- `profiles`: profil aplikasi yang mereferensikan `auth.users`.
- `institutions`: sekolah dan universitas.
- `internships`: periode PKL/magang; partial unique index membatasi satu internship aktif.
- `attendance_records`: attendance authoritative dan provenance `CHECK_IN`, `LEAVE`, atau `ADMIN_CORRECTION`.
- `journals`: jurnal opsional, maksimum satu per participant/tanggal.
- `leave_requests`: state `PENDING`, `APPROVED`, `REJECTED`, dengan exclusion constraint untuk overlap aktif.
- `attendance_settings`: singleton jadwal, lokasi, radius, threshold akurasi, dan pengaturan jurnal/foto.
- `audit_logs`: before/after JSON untuk administrative changes.

Duplicate attendance dilindungi oleh unique constraint `(participant_id, attendance_date)` dan advisory transaction lock. Approved leave membuat attendance `IZIN`/`SAKIT` pada setiap hari kerja dan menyimpan `leave_request_id`. `TIDAK_HADIR` tidak dibuat otomatis; status tersebut dihitung untuk laporan atau dibuat melalui koreksi admin.

## RLS Matrix

| Resource    | Participant                                  | Admin                              |
| ----------- | -------------------------------------------- | ---------------------------------- |
| Profile     | Read own                                     | Read all                           |
| Institution | Read institution terkait                     | Read/create/update                 |
| Internship  | Read own                                     | Read all                           |
| Attendance  | Read own; no direct writes                   | Read all; corrections via function |
| Journal     | Read own; insert/update own journal hari ini | Read all                           |
| Leave       | Read/insert own pending request              | Read all; review via function      |
| Settings    | Read                                         | Read; update via function          |
| Audit       | No access                                    | Read-only                          |
| Storage     | Upload/read own prefix                       | Read authorized evidence           |

RLS memanggil `public.is_admin()`, yang hanya menganggap profile admin aktif sebagai administrator.

## Storage

Private buckets:

| Bucket              | Limit | MIME                 |
| ------------------- | ----- | -------------------- |
| `attendance-photos` | 1 MiB | JPEG, PNG, WebP      |
| `leave-attachments` | 5 MiB | JPEG, PNG, WebP, PDF |
| `avatars`           | 2 MiB | JPEG, PNG, WebP      |

Object path wajib dimulai dengan UUID owner:

```text
attendance-photos/{participantId}/{YYYY-MM-DD}/check-in-{uuid}.jpg
attendance-photos/{participantId}/{YYYY-MM-DD}/check-out-{uuid}.jpg
leave-attachments/{participantId}/{leaveId}/{uuid}.pdf
avatars/{participantId}/{uuid}.webp
```

`create-signed-url` memberikan URL selama 300 detik setelah memverifikasi caller sebagai owner atau admin. Attendance function juga memverifikasi object ada di bucket dan prefix participant yang benar.

## Edge Functions

Semua endpoint menerima `POST`, JWT user, dan JSON. Error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "ERROR_CODE"
  }
}
```

### `check-in`

```json
{
  "photoPath": "participant-id/2026-09-22/check-in-uuid.jpg",
  "latitude": -6.0,
  "longitude": 106.0,
  "accuracyMeters": 20
}
```

Validasi mencakup JWT, role participant, account/internship aktif, hari kerja, duplicate, private photo ownership, koordinat, akurasi, dan radius. Response memuat `id`, `date`, `checkInAt`, `status`, `lateMinutes`, dan `distanceMeters`.

### `check-out`

```json
{
  "journalContent": "Opsional",
  "photoPath": "participant-id/2026-09-22/check-out-uuid.jpg"
}
```

`journalContent` opsional. `photoPath` wajib hanya bila `require_checkout_photo` aktif. Checkout mengubah attendance hari ini dengan server timestamp dan meng-upsert jurnal non-kosong.

### Admin functions

Backend menyediakan sepuluh Edge Functions. Endpoint administratif meliputi:

- `admin-create-participant`: membuat Auth user dengan password langsung (manual atau auto-generate, tanpa undangan email), lalu membuat profile, internship, dan audit. Duplikat email ditolak ramah; rollback hanya menghapus akun yang baru dibuat detik itu.
- `admin-import-participants`: batch maks 100 baris (satu institusi/tipe/periode); validasi + cek duplikat email/NIS dulu, buat akun per baris dengan password auto-generate, retry terbatas saat Auth rate-limit, adopsi akun yatim tanpa profile. Mengembalikan kredensial sekali-tampil + gagal per baris.
- `admin-update-participant`: menyinkronkan email Auth/profile, data profile/internship, active state, dan audit.
- `admin-upload-avatar`: memvalidasi dan mengunggah avatar participant ke bucket private, memperbarui `profiles.avatar_path`, lalu menghapus avatar lama secara best-effort.
- `admin-correct-attendance`: menerima `attendanceId`, `reason`, serta optional `status`, `checkInAt`, `checkOutAt`.
- `review-leave`: menerima `leaveRequestId`, `decision`, dan optional `adminNote`.
- `update-attendance-settings`: mengubah seluruh settings attendance dan membuat audit.
- `create-signed-url`: menerima `bucket` dan `path`.

Perubahan role-sensitive diverifikasi kembali oleh PostgreSQL RPC, bukan hanya Edge Function.

## Seed

`supabase/seed.sql` hanya berisi data fiktif:

- `admin@presensia.test`
- `participant.one@presensia.test`
- `participant.two@presensia.test`
- sekolah, universitas, dan nomor peserta fiktif
- koordinat fiktif `0.123456, 100.654321`

Password seed diacak setiap kali seed berjalan dan tidak dicatat. Cloud integration test menetapkan password sementara melalui server-only Auth Admin API.

Default development settings:

- Workdays: Senin-Jumat
- Check-in: 08:00 WIB
- Tolerance: 15 menit
- Checkout: 16:00 WIB
- Radius: 150 meter
- Maximum accepted GPS accuracy: 100 meter
- Checkout photo: tidak wajib

Nilai tersebut wajib diganti admin sebelum penggunaan operasional.

## Deployment

CLI harus login dan repository harus ditautkan ke project yang benar:

```bash
supabase projects list
supabase link --project-ref YOUR_PROD_PROJECT_REF
pnpm backend:dry-run
pnpm backend:deploy
```

Periksa project ref sebelum `backend:deploy`. Jangan menjalankan reset remote setelah project berisi data operasional.

Untuk memeriksa status:

```bash
supabase migration list
supabase functions list --project-ref YOUR_PROD_PROJECT_REF
supabase db lint --linked --level warning
```

## Testing

Database test:

```bash
supabase start
supabase db reset
pnpm backend:test:db
```

Cloud integration test membutuhkan credential yang diinjeksi ke proses. Jangan menulis service-role key ke `.env` client atau shell history. Test mencakup:

- email/password authentication dan public-signup rejection;
- profile, attendance, leave, dan audit RLS;
- participant rejection pada admin endpoint;
- private upload dan denied public object access;
- radius dan GPS accuracy;
- concurrent duplicate check-in;
- server timestamp checkout dan duplicate checkout;
- direct attendance mutation rejection;
- correction before/after audit;
- leave approval dan attendance materialization;
- owner/admin signed URL authorization.

Script: `scripts/backend-cloud-test.mjs`.

## Production Checklist

- Ganti koordinat, jadwal, radius, dan threshold akurasi dengan keputusan Diskominfo.
- Konfigurasikan SMTP resmi sebelum menggunakan invitation/password recovery.
- Ganti `site_url` dan redirect allow-list dengan URL/deep link production.
- Hapus atau nonaktifkan akun `.test` dan data integration test.
- Tetapkan retention policy attendance photos dan leave attachments.
- Aktifkan backup/PITR sesuai tier dan lakukan restore drill.
- Review rate limits, SSL enforcement, network restrictions, dan applicable privacy policy.
- Jangan deploy dengan service-role key di source code, browser bundle, atau Expo public environment.
