import type { PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

// Dokumen root web Presensia (cermin aplikasi peserta).
// - Metadata PWA/install (iOS: meta apple-*, Android: manifest).
// - Font disajikan via @font-face statis (public/fonts): loader font JS
//   Expo terbukti 404 di hosting statis (folder node_modules tidak ikut
//   ter-upload), sehingga teks jatuh ke serif & ikon jadi kotak kosong.
// - Layar lebar: aplikasi tampil sebagai kolom selebar HP di tengah
//   (maks 480px); layar HP: full-bleed persis seperti aplikasi.
const FONT_FACES = [
  ["PlusJakartaSans_400Regular", 400],
  ["PlusJakartaSans_500Medium", 500],
  ["PlusJakartaSans_600SemiBold", 600],
  ["PlusJakartaSans_700Bold", 700],
  ["PlusJakartaSans_800ExtraBold", 800],
] as const;
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Presensia" />
        <meta name="theme-color" content="#B85C42" />
        <meta
          name="description"
          content="Presensi PKL & Magang Diskominfo Banten. Hadir. Tercatat. Terpantau."
        />
        <link rel="apple-touch-icon" href="/icon-180.png" />
        <link rel="manifest" href="/manifest.json" />
        {FONT_FACES.map(([family]) => (
          <link
            key={family}
            rel="preload"
            href={`/fonts/${family}.ttf`}
            as="font"
            type="font/ttf"
            crossOrigin="anonymous"
          />
        ))}
        <link rel="preload" href="/fonts/Ionicons.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <style>{`${FONT_FACES.map(
          ([family, weight]) => `@font-face {
  font-family: "${family}";
  src: url("/fonts/${family}.ttf") format("truetype");
  font-weight: ${weight};
  font-style: normal;
  font-display: swap;
}`,
        ).join("\n")}
@font-face {
  font-family: "Ionicons";
  src: url("/fonts/Ionicons.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}`}</style>
        <style>{`@media (min-width: 560px) {
  body { display: flex; justify-content: center; background: #E7E1D6; }
  #root { width: 100%; max-width: 480px; min-height: 100dvh; background: #F7F4EF; box-shadow: 0 0 48px rgba(60, 48, 36, 0.18); }
}`}</style>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
