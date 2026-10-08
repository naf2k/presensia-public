import { AdminApiError } from "./errors";

const TIMEZONE = "Asia/Jakarta";

export function formatDate(value: string, withWeekday = false) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    weekday: withWeekday ? "long" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+07:00`));
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+07:00`));
}

export function formatTime(value: string | null, zone = false) {
  if (!value) return null;
  const result = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
  return zone ? `${result} WIB` : result;
}

export function formatShortTimestamp(value: string) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "short",
  }).format(date);
  return `${day} · ${formatTime(value) ?? "--.--"}`;
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function localDateTime(date: string, time: string) {
  return time ? `${date}T${time}:00+07:00` : undefined;
}

/**
 * Normalize a display time ("10.00" id-ID) into <input type="time"> value
 * ("10:00"). Returns "" when the value is not a valid HH:MM so the input
 * never receives an unparseable value and the edge never gets "10.00".
 */
export function timeInputValue(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value.replace(".", ":").slice(0, 5);
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : "";
}

export function dateInput(daysAgo = 0) {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function monthBounds(month: string) {
  const [year, value] = month.split("-").map(Number);
  if (!year || !value) throw new AdminApiError("INVALID_REQUEST");
  const start = `${year}-${String(value).padStart(2, "0")}-01`;
  const next =
    value === 12 ? `${year + 1}-01-01` : `${year}-${String(value + 1).padStart(2, "0")}-01`;
  return { start, next };
}
