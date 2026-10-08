// Konfigurasi distribusi aplikasi peserta (halaman publik /install).
//
// QR final hanya mengarah ke INSTALL_PATH. Mengganti APK / proyek Expo
// cukup lewat env lalu redeploy — QR cetak tidak perlu diganti.
export const INSTALL_PATH = "/install";

/** APK Android terbaru (build EAS internal, channel production). */
export const DEFAULT_APK_URL =
  "https://expo.dev/artifacts/eas/PldAUbGeal1D2RTHupcbDI6T-dVi6jdlsh5CHTjLclg.apk";

/** Halaman proyek Expo — tombol iPhone selalu membuka versi terbaru. */
export const DEFAULT_EXPO_PROJECT_URL =
  "https://expo.dev/accounts/nafi-bussinesss-team/projects/presensia-mobile";

/** ID proyek Expo (sama dengan updates.url di apps/mobile/app.json). */
export const EXPO_PROJECT_ID = "823e20f7-f1be-4952-83d3-8c7b5ca89e33";

/**
 * Runtime iOS untuk Expo Go — WAJIB sinkron dengan OTA iPhone
 * (channel production, runtime exposdk:57.0.0).
 */
export const DEFAULT_IOS_RUNTIME = "exposdk:57.0.0";

/** Channel OTA yang dibuka QR Expo Go. */
export const DEFAULT_EXPO_CHANNEL = "production";

/** Akun Viewer bersama untuk login Expo Go di iPhone. */
export const VIEWER_ACCOUNT_EMAIL = "presensia.diskominfo@gmail.com";

/** Kontak pendamping untuk footer halaman unduh. */
export const SUPPORT_CONTACT_NAME = "Nafi";
export const SUPPORT_CONTACT_PHONE = "08118110456";

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Baca env opsional (trim) atau pakai fallback bila kosong. */
function envOrDefault(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

/** URL penuh halaman unduh — nilai yang dienkode ke QR final. */
export function installPageUrl(): string {
  return `${appOrigin()}${INSTALL_PATH}`;
}

export function apkDownloadUrl(): string {
  return envOrDefault(process.env.NEXT_PUBLIC_APK_URL, DEFAULT_APK_URL);
}

export function expoProjectUrl(): string {
  return envOrDefault(process.env.NEXT_PUBLIC_EXPO_PROJECT_URL, DEFAULT_EXPO_PROJECT_URL);
}

/**
 * Deep link channel-based untuk dibuka langsung di Expo Go
 * (buka Expo Go → login → pindai). Selalu resolve ke update terbaru
 * pada channel + runtime di atas, tidak mengunci satu versi.
 * Terverifikasi via https://qr.expo.dev/eas-update (format=url).
 */
export function expoGoQrUrl(): string {
  const projectId = envOrDefault(process.env.NEXT_PUBLIC_EXPO_PROJECT_ID, EXPO_PROJECT_ID);
  const runtime = envOrDefault(process.env.NEXT_PUBLIC_EXPO_RUNTIME, DEFAULT_IOS_RUNTIME);
  const channel = envOrDefault(process.env.NEXT_PUBLIC_EXPO_CHANNEL, DEFAULT_EXPO_CHANNEL);
  return (
    `exp://u.expo.dev/${projectId}` +
    `?runtime-version=${encodeURIComponent(runtime)}` +
    `&channel-name=${encodeURIComponent(channel)}`
  );
}

export function supportWhatsappUrl(
  message = "Halo, saya peserta PKL/magang dan butuh bantuan aplikasi Presensia.",
): string {
  const digits = SUPPORT_CONTACT_PHONE.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
