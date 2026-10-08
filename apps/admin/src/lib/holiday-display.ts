// Tampil kalender libur: pisah mendatang/lewat + chip tanggal Indonesia.

export interface HolidayItem {
  date: string; // YYYY-MM-DD
  name: string;
}

function parseYmd(iso: string): [number, number, number] {
  const parts = iso.split("-").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 1, parts[2] ?? 1];
}

export function splitHolidays(
  holidays: HolidayItem[],
  todayYmd: string,
): { upcoming: HolidayItem[]; past: HolidayItem[] } {
  const upcoming = holidays
    .filter((h) => h.date >= todayYmd)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const past = holidays
    .filter((h) => h.date < todayYmd)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
  return { upcoming, past };
}

export function formatHolidayChip(dateYmd: string): { day: string; month: string } {
  const [y, m, d] = parseYmd(dateYmd);
  const atNoon = new Date(Date.UTC(y, m - 1, d, 5));
  const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: "Asia/Jakarta" }).format(
    atNoon,
  );
  const month = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" }).format(
    atNoon,
  );
  return { day, month };
}

export function formatHolidayLong(dateYmd: string): string {
  const [y, m, d] = parseYmd(dateYmd);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Date.UTC(y, m - 1, d, 5)));
}
