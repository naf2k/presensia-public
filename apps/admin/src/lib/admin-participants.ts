import type { AdminParticipant, ParticipantFilter, ParticipantInput } from "./admin-api";
import { AdminApiError, normalizeError } from "./errors";
import { formatDate } from "./format";
import { supabase } from "./supabase";
import { mapAttendance } from "./admin-attendance";
import { mapJournal } from "./admin-journals";
import { mapLeave } from "./admin-leaves";
import type { RawAttendance, RawJournal, RawLeave, RawProfile } from "./admin-shared";
import { avatarVariant, daysBetween, invoke, one, operationalContext } from "./admin-shared";

export const PARTICIPANT_SELECT =
  "id,full_name,email,phone,avatar_path,is_active,updated_at,internships(id,institution_id,participant_type,student_number,major,start_date,end_date,is_active,created_at,institutions(id,name,institution_type,city,is_active))";

export function mapParticipant(profile: RawProfile, operationalDate: string): AdminParticipant {
  const internships = [...(profile.internships ?? [])].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
  const internship = internships[0];
  if (!internship) throw new AdminApiError("INTERNSHIP_INACTIVE");
  const institution = one(internship.institutions);
  if (!institution) throw new AdminApiError("BACKEND_FAILURE");
  const remaining = daysBetween(operationalDate, internship.end_date);
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone ?? "",
    avatarPath: profile.avatar_path,
    studentNumber: internship.student_number,
    participantType: internship.participant_type,
    category: internship.participant_type === "SMK_PKL" ? "SMK PKL" : "Mahasiswa Magang",
    institutionId: institution.id,
    institution: institution.name,
    institutionShort: institution.name,
    institutionType: institution.institution_type,
    major: internship.major,
    majorShort: internship.major,
    city: institution.city ?? "-",
    periodLabel: `${formatDate(internship.start_date)} - ${formatDate(internship.end_date)}`,
    periodStart: internship.start_date,
    periodEnd: internship.end_date,
    remainingLabel: remaining < 0 ? "Periode selesai" : `${remaining} hari tersisa`,
    isActive: profile.is_active && internship.is_active,
    endingSoon: remaining >= 0 && remaining <= 7,
    avatarVariant: avatarVariant(profile.id),
    updatedAt: profile.updated_at,
  };
}

export type ParticipantIndex = {
  date: string;
  participants: AdminParticipant[];
  byId: Map<string, AdminParticipant>;
};

let participantIndexCache: { expiresAt: number; value: ParticipantIndex } | null = null;

export function clearParticipantIndex() {
  participantIndexCache = null;
}

export async function participantIndex() {
  if (participantIndexCache && Date.now() < participantIndexCache.expiresAt) {
    return participantIndexCache.value;
  }
  const context = await operationalContext();
  const date = context.operationalDate;
  const { data, error } = await supabase
    .from("profiles")
    .select(PARTICIPANT_SELECT)
    .eq("role", "participant");
  if (error) throw normalizeError(error);
  const participants = (data as unknown as RawProfile[]).flatMap((profile) => {
    try {
      return [mapParticipant(profile, date)];
    } catch {
      return [];
    }
  });
  const value = {
    date,
    participants,
    byId: new Map(participants.map((participant) => [participant.id, participant])),
  };
  participantIndexCache = { expiresAt: Date.now() + 15_000, value };
  return value;
}

export async function participants(filter: ParticipantFilter, page: number, perPage: number) {
  const { date, participants: all } = await participantIndex();
  const query = filter.query.trim().toLowerCase();
  const rows = all.filter((participant) => {
    if (
      query &&
      ![participant.name, participant.studentNumber, participant.email].some((value) =>
        value.toLowerCase().includes(query),
      )
    )
      return false;
    if (filter.category !== "all" && participant.category !== filter.category) return false;
    if (filter.institution !== "all" && participant.institutionId !== filter.institution)
      return false;
    if (filter.status === "active" && !participant.isActive) return false;
    if (filter.status === "inactive" && participant.isActive) return false;
    if (
      filter.period === "active" &&
      (date < participant.periodStart || date > participant.periodEnd)
    )
      return false;
    if (filter.period === "ended" && date <= participant.periodEnd) return false;
    return true;
  });
  return {
    rows: rows.slice((page - 1) * perPage, page * perPage),
    total: rows.length,
    activeTotal: all.filter((participant) => participant.isActive).length,
  };
}

export async function participant(id: string) {
  const { date, byId } = await participantIndex();
  const participant = byId.get(id);
  if (!participant) throw new AdminApiError("PARTICIPANT_NOT_FOUND");
  const [attendanceResult, journalResult, leaveResult] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("*")
      .eq("participant_id", id)
      .order("attendance_date", { ascending: false }),
    supabase
      .from("journals")
      .select("*")
      .eq("participant_id", id)
      .order("journal_date", { ascending: false }),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("participant_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (attendanceResult.error) throw normalizeError(attendanceResult.error);
  if (journalResult.error) throw normalizeError(journalResult.error);
  if (leaveResult.error) throw normalizeError(leaveResult.error);
  const rawAttendance = attendanceResult.data as RawAttendance[];
  const rawJournals = journalResult.data as RawJournal[];
  const journals = rawJournals.map((journal) =>
    mapJournal(
      journal,
      participant,
      rawAttendance.find((attendance) => attendance.id === journal.attendance_id),
    ),
  );
  const journalsByDate = new Map(journals.map((journal) => [journal.journalDate, journal]));
  const history = rawAttendance.map((attendance) =>
    mapAttendance(attendance, participant, journalsByDate.get(attendance.attendance_date) ?? null),
  );
  const leaves = (leaveResult.data as RawLeave[]).map((leave) => mapLeave(leave, participant));
  const stats = {
    total: history.length,
    hadir: history.filter((item) => item.status === "HADIR").length,
    terlambat: history.filter((item) => item.status === "TERLAMBAT").length,
    izin: history.filter((item) => item.status === "IZIN").length,
    sakit: history.filter((item) => item.status === "SAKIT").length,
    tidakHadir: history.filter((item) => item.status === "TIDAK_HADIR").length,
  };
  const present = stats.hadir + stats.terlambat;
  return {
    date,
    participant,
    history,
    leaves,
    journals,
    latestJournal: journals[0] ?? null,
    stats: {
      ...stats,
      attendanceRate: stats.total ? Math.round((present / stats.total) * 100) : 0,
    },
  };
}

export async function uploadAvatar(participantId: string, file: File) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) throw new AdminApiError("INVALID_FILE_TYPE");
  if (file.size > 2 * 1024 * 1024) throw new AdminApiError("FILE_TOO_LARGE");
  let base64: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    }
    base64 = btoa(binary);
  } catch {
    throw new AdminApiError("UPLOAD_FAILED");
  }
  return invoke("admin-upload-avatar", {
    participantId,
    fileName: file.name,
    contentType: file.type,
    base64,
  });
}

export async function saveParticipant(input: ParticipantInput) {
  const response = await invoke<{
    success: true;
    participant: { profile?: { id?: string } };
    password?: string;
    generated?: boolean;
  }>(input.id ? "admin-update-participant" : "admin-create-participant", {
    participantId: input.id,
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName.trim(),
    phone: input.phone.trim() || undefined,
    institutionId: input.institutionId,
    participantType: input.participantType,
    studentNumber: input.studentNumber.trim(),
    major: input.major.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    isActive: input.isActive,
    reason: input.reason?.trim() || undefined,
    password: input.password?.trim() || undefined,
  });
  const participantId = input.id ?? response.participant?.profile?.id;
  if (!participantId) throw new AdminApiError("BACKEND_FAILURE");
  if (input.avatar) await uploadAvatar(participantId, input.avatar);
  // Writes invalidate the index immediately instead of waiting out the TTL.
  clearParticipantIndex();
  return {
    id: participantId,
    password: response.password,
    generated: response.generated,
  };
}

export interface ImportBatchRowInput {
  studentNumber: string;
  fullName: string;
  major: string;
  email: string;
  phone: string;
  institutionId?: string;
  participantType?: "SMK_PKL" | "UNIVERSITY_INTERN";
  startDate?: string;
  endDate?: string;
  newInstitution?: { name: string; type: "SMK" | "UNIVERSITY" };
}

export interface ImportBatchInput {
  institutionId?: string;
  participantType?: "SMK_PKL" | "UNIVERSITY_INTERN";
  startDate?: string;
  endDate?: string;
  rows: ImportBatchRowInput[];
}

export interface ImportBatchResult {
  succeeded: Array<{ email: string; password: string; participantId: string }>;
  failed: Array<{ email: string; code: string }>;
}

export async function importParticipants(input: ImportBatchInput): Promise<ImportBatchResult> {
  const response = await invoke<{ success: true } & ImportBatchResult>(
    "admin-import-participants",
    {
      institutionId: input.institutionId,
      participantType: input.participantType,
      startDate: input.startDate,
      endDate: input.endDate,
      rows: input.rows,
    },
  );
  clearParticipantIndex();
  return { succeeded: response.succeeded ?? [], failed: response.failed ?? [] };
}
