import type { AttendanceStatus } from "@presensia/types";
import type {
  AdminAttendance,
  AdminJournal,
  AdminParticipant,
  AttendanceFilter,
} from "./admin-api";
import { AdminApiError, normalizeError } from "./errors";
import { formatDate, formatTime } from "./format";
import { supabase } from "./supabase";
import { participantIndex } from "./admin-participants";
import { mapJournal } from "./admin-journals";
import type { RawAttendance, RawJournal } from "./admin-shared";
import { invoke, matchingParticipantIds, photoTone } from "./admin-shared";

export function mapAttendance(
  raw: RawAttendance,
  participant: AdminParticipant,
  journal: AdminJournal | null,
): AdminAttendance {
  return {
    id: raw.id,
    recordId: raw.id,
    participantId: raw.participant_id,
    participant,
    attendanceDate: raw.attendance_date,
    dateLabel: formatDate(raw.attendance_date),
    weekdayLabel: new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      timeZone: "Asia/Jakarta",
    }).format(new Date(`${raw.attendance_date}T12:00:00+07:00`)),
    checkIn: formatTime(raw.check_in_at),
    checkOut: formatTime(raw.check_out_at),
    checkInAt: raw.check_in_at,
    checkOutAt: raw.check_out_at,
    status: raw.status,
    lateMinutes: raw.late_minutes,
    earlyCheckoutMinutes: raw.early_checkout_minutes ?? 0,
    workDurationMinutes: raw.work_duration_minutes,
    autoAbsence: raw.policy_snapshot?.autoAbsence === true,
    photoTone: photoTone(raw.id),
    checkInPhotoPath: raw.check_in_photo_path,
    checkOutPhotoPath: raw.check_out_photo_path,
    latitude: raw.check_in_latitude,
    longitude: raw.check_in_longitude,
    accuracyMeters: raw.check_in_accuracy_m,
    distanceMeters: raw.check_in_distance_m,
    corrected: Boolean(raw.corrected_at),
    hasJournal: Boolean(journal),
    journalState: journal ? "Terisi" : "Belum diisi",
    journal,
    note: null,
  };
}

export async function attendance(filter: AttendanceFilter, page: number, perPage: number) {
  const { byId, participants } = await participantIndex();
  const query = filter.query.trim().toLowerCase();
  // Server-side ID prefilter (name/NIM/institution) so .range() pages exact
  // results instead of slicing a truncated full fetch (PostgREST max_rows).
  const ids = matchingParticipantIds(
    participants,
    (participant) =>
      (filter.showInactive === true || participant.isActive) &&
      (filter.institution === "all" || participant.institutionId === filter.institution) &&
      (!query ||
        [participant.name, participant.studentNumber].some((value) =>
          value.toLowerCase().includes(query),
        )),
  );
  const emptySummary = { total: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, tidakHadir: 0 };
  if (ids !== null && ids.length === 0) return { rows: [], total: 0, summary: emptySummary };
  const scoped = (status: AttendanceStatus | null, head: boolean) => {
    // Summary keeps legacy semantics: every band figure respects the status
    // filter, so a filtered view shows zeros for the other statuses.
    let request = supabase
      .from("attendance_records")
      .select(head ? "id" : "*", { count: "exact", head })
      .gte("attendance_date", filter.dateFrom)
      .lte("attendance_date", filter.dateTo)
      .order("attendance_date", { ascending: false })
      .order("id", { ascending: false });
    if (status) request = request.eq("status", status);
    if (filter.status !== "all") request = request.eq("status", filter.status);
    if (ids) request = request.in("participant_id", ids);
    return request;
  };
  const from = (page - 1) * perPage;
  const [paged, ...statusCounts] = await Promise.all([
    scoped(null, false).range(from, from + perPage - 1),
    ...(["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "TIDAK_HADIR"] as AttendanceStatus[]).map(
      (status) => scoped(status, true),
    ),
  ]);
  if (paged.error) throw normalizeError(paged.error);
  const rows = ((paged.data ?? []) as RawAttendance[]).flatMap((raw) => {
    const participant = byId.get(raw.participant_id);
    return participant ? [mapAttendance(raw, participant, null)] : [];
  });
  const [hadir, terlambat, izin, sakit, tidakHadir] = statusCounts.map((result) => {
    if (result.error) throw normalizeError(result.error);
    return result.count ?? 0;
  });
  const total = paged.count ?? 0;
  return {
    rows,
    total,
    summary: { total, hadir, terlambat, izin, sakit, tidakHadir },
  };
}

export async function attendanceDetail(id: string) {
  const { byId } = await participantIndex();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw normalizeError(error);
  if (!data) throw new AdminApiError("ATTENDANCE_NOT_FOUND");
  const raw = data as RawAttendance;
  const participant = byId.get(raw.participant_id);
  if (!participant) throw new AdminApiError("PARTICIPANT_NOT_FOUND");
  const [journalResult, auditResult] = await Promise.all([
    supabase
      .from("journals")
      .select("*")
      .eq("participant_id", raw.participant_id)
      .eq("journal_date", raw.attendance_date)
      .maybeSingle(),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_id", id)
      .eq("action", "ATTENDANCE_CORRECTED")
      .order("created_at", { ascending: false }),
  ]);
  if (journalResult.error) throw normalizeError(journalResult.error);
  if (auditResult.error) throw normalizeError(auditResult.error);
  const journal = journalResult.data
    ? mapJournal(journalResult.data as RawJournal, participant, raw)
    : null;
  return {
    row: mapAttendance(raw, participant, journal),
    participant,
    audit: auditResult.data ?? [],
  };
}

export async function saveCorrection(input: {
  id: string;
  status: AttendanceStatus;
  checkInAt?: string;
  checkOutAt?: string;
  reason: string;
}) {
  return invoke("admin-correct-attendance", {
    attendanceId: input.id,
    status: input.status,
    checkInAt: input.checkInAt,
    checkOutAt: input.checkOutAt,
    reason: input.reason,
    operationId: crypto.randomUUID(),
  });
}

export async function createAttendance(input: {
  participantId: string;
  date: string;
  status: AttendanceStatus;
  reason: string;
  checkInAt?: string;
  checkOutAt?: string;
  photoPath?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}) {
  return invoke("admin-create-attendance", {
    participantId: input.participantId,
    date: input.date,
    status: input.status,
    reason: input.reason,
    checkInAt: input.checkInAt,
    checkOutAt: input.checkOutAt,
    photoPath: input.photoPath,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    operationId: crypto.randomUUID(),
  });
}

export async function closeDay(date: string) {
  const { data, error } = await supabase.rpc("materialize_absences", { p_target_date: date });
  if (error) throw normalizeError(error);
  return data as { date: string; created: number };
}
