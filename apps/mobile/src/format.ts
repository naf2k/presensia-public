const timezone = "Asia/Jakarta";

export function isoDateInJakarta(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    ...(options ?? { day: "numeric", month: "long", year: "numeric" }),
  }).format(new Date(`${value}T12:00:00+07:00`));
}

export function formatTimestamp(value: string | null, includeZone = false) {
  if (!value) return "--:--";
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
  return includeZone ? `${formatted} WIB` : formatted;
}

export function formatMonthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .slice(0, 7);
}

export function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) throw new Error("INVALID_MONTH");
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, nextMonth };
}

const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function workdayLabel(days: number[]) {
  return [...days]
    .sort((a, b) => a - b)
    .map((day) => DAY_SHORT[day % 7] ?? "")
    .filter(Boolean)
    .join(", ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function errorMessage(error: unknown) {
  if (error instanceof MobileApiError) return error.message;
  if (error instanceof Error && /network|fetch/i.test(error.message)) {
    return "Belum dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.";
  }
  return "Terjadi kendala saat memproses permintaan. Silakan coba lagi.";
}

export class MobileApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
