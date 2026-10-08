import type { AdminInstitution, InstitutionInput, InstitutionOption } from "./admin-api";
import { AdminApiError, normalizeError } from "./errors";
import { supabase } from "./supabase";
import { clearParticipantIndex } from "./admin-participants";
import { scheduleSummary } from "./admin-schedules";
import type { RawInstitution } from "./admin-shared";

export async function institutions(): Promise<InstitutionOption[]> {
  const { data, error } = await supabase
    .from("institutions")
    .select("id,name,institution_type,city")
    .eq("is_active", true)
    .order("name");
  if (error) throw normalizeError(error);
  return (data as RawInstitution[]).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.institution_type,
    city: item.city,
  }));
}

export async function institutionsAll(): Promise<AdminInstitution[]> {
  const [{ data, error }, countResult, schedResult] = await Promise.all([
    supabase
      .from("institutions")
      .select("id,name,institution_type,city,is_active")
      .order("is_active", { ascending: false })
      .order("name"),
    supabase.from("internships").select("institution_id,is_active"),
    supabase
      .from("institution_day_schedules")
      .select("institution_id,weekday,check_in_time,check_out_time,late_tolerance_minutes")
      .order("weekday"),
  ]);
  if (error) throw normalizeError(error);
  if (countResult.error) throw normalizeError(countResult.error);
  if (schedResult.error) throw normalizeError(schedResult.error);
  const counts = new Map<string, { active: number; total: number }>();
  for (const row of (countResult.data ?? []) as {
    institution_id: string;
    is_active: boolean;
  }[]) {
    const entry = counts.get(row.institution_id) ?? { active: 0, total: 0 };
    entry.total += 1;
    if (row.is_active) entry.active += 1;
    counts.set(row.institution_id, entry);
  }
  const schedByInst = new Map<string, { weekday: number; checkIn: string | null; checkOut: string | null; tolerance: number | null }[]>();
  for (const row of ((schedResult.data ?? []) as {
    institution_id: string;
    weekday: number;
    check_in_time: string | null;
    check_out_time: string | null;
    late_tolerance_minutes: number | null;
  }[])) {
    const list = schedByInst.get(row.institution_id) ?? [];
    list.push({
      weekday: row.weekday,
      checkIn: row.check_in_time,
      checkOut: row.check_out_time,
      tolerance: row.late_tolerance_minutes,
    });
    schedByInst.set(row.institution_id, list);
  }
  return (data as RawInstitution[]).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.institution_type,
    typeLabel: item.institution_type === "SMK" ? "SMK" : "Universitas",
    city: item.city,
    isActive: item.is_active,
    activeInternships: counts.get(item.id)?.active ?? 0,
    totalInternships: counts.get(item.id)?.total ?? 0,
    scheduleSummary: scheduleSummary(schedByInst.get(item.id) ?? []),
  }));
}

export async function saveInstitution(input: InstitutionInput): Promise<{ id: string }> {
  const name = input.name.trim();
  const city = input.city.trim();
  if (name.length < 2 || name.length > 150) throw new AdminApiError("INVALID_REQUEST");
  if (city.length > 100) throw new AdminApiError("INVALID_REQUEST");
  if (input.type !== "SMK" && input.type !== "UNIVERSITY")
    throw new AdminApiError("INVALID_REQUEST");
  const payload = {
    name,
    institution_type: input.type,
    city: city || null,
    is_active: input.isActive,
  };
  if (input.id) {
    const { error } = await supabase.from("institutions").update(payload).eq("id", input.id);
    if (error) {
      if ((error as { code?: string }).code === "23505")
        throw new AdminApiError("INSTITUTION_DUPLICATE");
      throw normalizeError(error);
    }
    clearParticipantIndex();
    return { id: input.id };
  }
  const { data, error } = await supabase.from("institutions").insert(payload).select("id").single();
  if (error) {
    if ((error as { code?: string }).code === "23505")
      throw new AdminApiError("INSTITUTION_DUPLICATE");
    throw normalizeError(error);
  }
  clearParticipantIndex();
  return { id: (data as { id: string }).id };
}
