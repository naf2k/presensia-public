/**
 * @presensia/utils — util murni yang dapat dipakai ulang (tanpa I/O, tanpa network).
 * Aturan presensi tetap ditegakkan backend (PRD BR-002/BR-007); fungsi di sini
 * hanya helper presentasi/perhitungan sisi klien.
 */
import { APP_TIMEZONE } from "@presensia/constants";

/** Gabung class names; abaikan nilai falsy. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Format tanggal ke zona operasional Asia/Jakarta (PRD BR-015). */
export function formatDateWIB(
  input: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIMEZONE,
    ...options,
  }).format(date);
}

/** Format jam ke zona operasional Asia/Jakarta. */
export function formatTimeWIB(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Jarak haversine dalam meter antara dua titik koordinat.
 * Murni matematika; keputusan radius tetap di backend (PRD BR-006/FR-004).
 */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ambil inisial nama untuk avatar fallback. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Potong teks aman untuk ringkasan tabel (PRD §19). */
export function truncate(text: string, max = 80): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
