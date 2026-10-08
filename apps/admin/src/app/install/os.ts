// Deteksi OS dari user-agent untuk halaman unduh publik (/install).
// Dipakai server-side via headers() agar halaman langsung menampilkan
// panduan yang tepat tanpa JavaScript.
export type OsKind = "android" | "ios" | "other";

export function detectOs(userAgent: string | null | undefined): OsKind {
  if (!userAgent) return "other";
  const ua = userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("ipod") ||
    // iPadOS 13+ mode desktop melaporkan "Macintosh" + penanda "Mobile".
    (ua.includes("macintosh") && ua.includes("mobile"))
  ) {
    return "ios";
  }
  return "other";
}
