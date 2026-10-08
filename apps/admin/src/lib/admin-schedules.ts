import { AdminApiError, normalizeError } from "./errors";
import { supabase } from "./supabase";

export interface InstitutionDaySchedule {
  weekday: number;
  checkIn: string | null;
  checkOut: string | null;
  tolerance: number | null;
}

interface RawSchedule {
  weekday: number;
  check_in_time: string | null;
  check_out_time: string | null;
  late_tolerance_minutes: number | null;
}

export const WEEKDAY_LABEL = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function scheduleSummary(rows: InstitutionDaySchedule[]): string | null {
  if (rows.length === 0) return null;
  const byDay = new Map(rows.map((r) => [r.weekday, r]));
  const parts: string[] = [];
  for (let d = 1; d <= 7; d += 1) {
    const row = byDay.get(d);
    if (!row) continue;
    const label = WEEKDAY_LABEL[d - 1];
    if (row.checkIn) parts.push(`${label} ${row.checkIn.slice(0, 5)}`);
    else parts.push(`${label} (global)`);
  }
  return parts.length > 0 ? `Khusus: ${parts.join(" · ")}` : null;
}

export async function listSchedules(institutionId: string): Promise<InstitutionDaySchedule[]> {
  const { data, error } = await supabase
    .from("institution_day_schedules")
    .select("weekday,check_in_time,check_out_time,late_tolerance_minutes")
    .eq("institution_id", institutionId)
    .order("weekday");
  if (error) throw normalizeError(error);
  return ((data ?? []) as RawSchedule[]).map((item) => ({
    weekday: item.weekday,
    checkIn: item.check_in_time,
    checkOut: item.check_out_time,
    tolerance: item.late_tolerance_minutes,
  }));
}

export async function saveSchedules(
  institutionId: string,
  rows: InstitutionDaySchedule[],
): Promise<void> {
  for (const row of rows) {
    if (!Number.isInteger(row.weekday) || row.weekday < 1 || row.weekday > 7)
      throw new AdminApiError("INVALID_REQUEST");
    if (row.checkIn !== null && !TIME_PATTERN.test(row.checkIn))
      throw new AdminApiError("INVALID_REQUEST");
    if (row.checkOut !== null && !TIME_PATTERN.test(row.checkOut))
      throw new AdminApiError("INVALID_REQUEST");
    if (
      row.tolerance !== null &&
      (!Number.isInteger(row.tolerance) || row.tolerance < 0 || row.tolerance > 180)
    )
      throw new AdminApiError("INVALID_REQUEST");
  }
  const del = await supabase.from("institution_day_schedules").delete().eq("institution_id", institutionId);
  if (del.error) throw normalizeError(del.error);
  if (rows.length === 0) return;
  const ins = await supabase.from("institution_day_schedules").insert(
    rows.map((row) => ({
      institution_id: institutionId,
      weekday: row.weekday,
      check_in_time: row.checkIn,
      check_out_time: row.checkOut,
      late_tolerance_minutes: row.tolerance,
    })),
  );
  if (ins.error) throw normalizeError(ins.error);
}
