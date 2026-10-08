import type { AdminSettings } from "./admin-api";
import { AdminApiError, normalizeError } from "./errors";
import { formatTimestamp } from "./format";
import { supabase } from "./supabase";
import { invoke } from "./admin-shared";

export async function settings() {
  const { data, error } = await supabase.from("attendance_settings").select("*").single();
  if (error) throw normalizeError(error);
  const updatedBy = data.updated_by
    ? await supabase.from("profiles").select("full_name").eq("id", data.updated_by).maybeSingle()
    : { data: null, error: null };
  if (updatedBy.error) throw normalizeError(updatedBy.error);
  const active = new Set<number>(data.work_days);
  return {
    settings: {
      workDays: Array.from({ length: 7 }, (_, index) => active.has(index + 1)),
      checkInTime: String(data.check_in_time).slice(0, 5),
      checkOutTime: String(data.check_out_time).slice(0, 5),
      lateTolerance: data.late_tolerance_minutes,
      locationName: data.location_name,
      latitude: String(data.latitude),
      longitude: String(data.longitude),
      radius: data.radius_meters,
      maxLocationAccuracyMeters: data.max_location_accuracy_meters,
      requireCheckoutPhoto: data.require_checkout_photo,
      maxJournalLength: data.max_journal_length,
      updatedLabel: `${updatedBy.data?.full_name ?? "Sistem"} · ${formatTimestamp(data.updated_at)} WIB`,
    } satisfies AdminSettings,
  };
}

export async function saveSettings(settings: AdminSettings) {
  return invoke("update-attendance-settings", {
    workDays: settings.workDays.flatMap((enabled, index) => (enabled ? [index + 1] : [])),
    checkInTime: settings.checkInTime,
    lateToleranceMinutes: settings.lateTolerance,
    checkOutTime: settings.checkOutTime,
    locationName: settings.locationName.trim(),
    latitude: Number(settings.latitude),
    longitude: Number(settings.longitude),
    radiusMeters: settings.radius,
    maxLocationAccuracyMeters: settings.maxLocationAccuracyMeters,
    requireCheckoutPhoto: settings.requireCheckoutPhoto,
    maxJournalLength: settings.maxJournalLength,
  });
}

export async function holidays(): Promise<{ date: string; name: string }[]> {
  const { data, error } = await supabase
    .from("holiday_calendar")
    .select("holiday_date,name")
    .order("holiday_date");
  if (error) throw normalizeError(error);
  return (data as { holiday_date: string; name: string }[]).map((row) => ({
    date: row.holiday_date,
    name: row.name,
  }));
}

export async function addHoliday(date: string, name: string) {
  const clean = name.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || clean.length < 2) {
    throw new AdminApiError("INVALID_REQUEST");
  }
  const { error } = await supabase
    .from("holiday_calendar")
    .upsert({ holiday_date: date, name: clean }, { onConflict: "holiday_date" });
  if (error) throw normalizeError(error);
}

export async function removeHoliday(date: string) {
  const { error } = await supabase.from("holiday_calendar").delete().eq("holiday_date", date);
  if (error) throw normalizeError(error);
}

export async function cleanupOrphans() {
  const response = await invoke<{ success: true; scanned: number; deleted: string[] }>(
    "cleanup-orphans",
    {},
  );
  return { scanned: response.scanned, deleted: response.deleted };
}
