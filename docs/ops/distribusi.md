# Distribusi Aplikasi — Presensia (tanpa Play Store / App Store)

## QR final untuk peserta baru (satu QR untuk semua)

- Halaman publik: `https://presensia-admin.vercel.app/install` (tanpa login).
- QR dicetak dari halaman admin **/distribusi** (login admin → menu Sistem →
  Distribusi → Unduh QR PNG).
- Discan dari HP Android → tombol Download APK + 4 langkah; dari iPhone → tombol
  Buka di Expo Go + 4 langkah. Deteksi otomatis via user-agent.
- QR di halaman /install (bagian "Pindai dengan Expo Go", khusus iPhone) berisi
  deep link channel-based `exp://u.expo.dev/<projectId>?runtime-version=…&channel-name=production`
  — selalu membuka update terbaru, tidak mengunci satu versi. Dibangun oleh
  `expoGoQrUrl()` di `apps/admin/src/lib/install-config.ts`.
- QR tidak perlu diganti saat tautan berubah. Mengganti tautan: ubah env
  `NEXT_PUBLIC_APK_URL` / `NEXT_PUBLIC_EXPO_PROJECT_URL` di Vercel lalu redeploy.
- Bila runtime iOS berubah (SDK baru), sinkronkan `NEXT_PUBLIC_EXPO_RUNTIME`
  dengan runtime OTA iPhone, lalu redeploy — QR ikut benar otomatis.
- Saat menambah akun Viewer bersama baru / mengganti password akun resmi:
  perbarui panduan di `apps/admin/src/app/install/page.tsx` bila langkah berubah.

## Android (APK internal + OTA)

- Unduh APK terbaru:
  `https://expo.dev/artifacts/eas/PldAUbGeal1D2RTHupcbDI6T-dVi6jdlsh5CHTjLclg.apk`
  (build 9fc7d985, 29 Sep 2026 — bundle segar dari HEAD + diagnostik OTA via update berikutnya).
  APK lama (`7M7M5XyU…`, `OHQhLrEPz…`) deprecated — jangan disebar lagi.
- Di HP: izinkan "Install unknown apps" sekali saat diminta, lalu install.
- Login dengan akun peserta masing-masing (bukan akun Expo).
- Update berikutnya tiba otomatis (OTA, channel `production`) — tidak perlu
  install ulang kecuali ada perubahan native.

## iPhone (Expo Go + akun Viewer resmi)

Prasyarat (sekali saja, oleh pemilik): akun `presensia.diskominfo@gmail.com`
sudah menjadi **Viewer** di organisasi `nafi-bussinesss-team` (tempat proyek
tinggal sekarang). Proyek tidak lagi di akun pribadi.

Langkah per iPhone (sekali saja, ±5 menit):

1. Install **Expo Go** dari App Store (gratis).
2. Login Expo Go dengan `presensia.diskominfo@gmail.com`.
3. Buka proyek Presensia: `https://expo.dev/accounts/nafi-bussinesss-team/projects/presensia-mobile`
   (atau scan QR dari halaman update di dashboard) — aplikasi terbuka di dalam Expo Go.
4. Login dengan akun peserta masing-masing.

Besok-besok: buka Presensia dari daftar Recent di Expo Go. Update OTA masuk
otomatis (runtime `exposdk:57.0.0`).

## Operasional rilis

- Kirim perbaikan JS tanpa build ulang:
  `eas update --branch production --environment production --platform android`
  untuk APK; ulangi dengan runtime `exposdk:57.0.0` untuk iPhone/Expo Go
  (sementara via edit `runtimeVersion` di `app.json`, lalu kembalikan —
  pola ini sudah terbukti 2026-09-25).
- Build APK baru hanya bila ada perubahan native (modul baru, permission,
  icon, splash) atau ganti `runtimeVersion`:
  `eas build --platform android --profile preview`.
- Jangan putar password akun resmi bersama tanpa koordinasi — semua iPhone
  logout bareng. Pertimbangkan akun per staf bila tim membesar.

## Batasan yang disadari

- Expo Go per Mei 2026 hanya membuka proyek milik akun yang login — karena
  itu iPhone memakai akun resmi bersama (Viewer, tidak bisa ubah apa pun).
- Jalur Ad Hoc/TestFlight tetap terbuka (butuh Apple Developer $99/thn);
  bundle ID `id.go.bantenprov.presensia` sudah dicadangkan.
