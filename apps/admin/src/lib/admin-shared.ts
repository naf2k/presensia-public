import type {
  AttendanceStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  ParticipantType,
} from "@presensia/types";
import type { AdminParticipant, AvatarVariant, OperationalContext, PhotoTone } from "./admin-api";
import { AdminApiError, normalizeError } from "./errors";
import { supabase } from "./supabase";

export type RawInstitution = {
  id: string;
  name: string;
  institution_type: "SMK" | "UNIVERSITY";
  city: string | null;
  is_active: boolean;
};

export type RawInternship = {
  id: string;
  institution_id: string;
  participant_type: ParticipantType;
  student_number: string;
  major: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  institutions: RawInstitution | RawInstitution[] | null;
};

export type RawProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_path: string | null;
  is_active: boolean;
  updated_at: string;
  internships: RawInternship[];
};

export type RawAttendance = {
  id: string;
  participant_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_photo_path: string | null;
  check_out_photo_path: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy_m: number | null;
  check_in_distance_m: number | null;
  late_minutes: number;
  early_checkout_minutes: number;
  work_duration_minutes: number | null;
  policy_snapshot: { autoAbsence?: boolean } | null;
  corrected_at: string | null;
};

export type RawJournal = {
  id: string;
  participant_id: string;
  attendance_id: string | null;
  journal_date: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type RawLeave = {
  id: string;
  participant_id: string;
  type: LeaveRequestType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_path: string | null;
  status: LeaveRequestStatus;
  admin_note: string | null;
  created_at: string;
};

export type RawAudit = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_id: string;
  entity_type: string;
  reason: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
};

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  TIDAK_HADIR: "Tidak hadir",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ATTENDANCE_CORRECTED: "Koreksi presensi",
  LEAVE_APPROVED: "Menyetujui pengajuan",
  LEAVE_REJECTED: "Menolak pengajuan",
  PARTICIPANT_CREATED: "Menambah peserta",
  PARTICIPANT_UPDATED: "Mengubah peserta",
  PARTICIPANT_DEACTIVATED: "Menonaktifkan peserta",
  PARTICIPANT_REACTIVATED: "Mengaktifkan peserta",
  ATTENDANCE_SETTINGS_UPDATED: "Mengubah pengaturan",
  SETTINGS_UPDATED: "Menerapkan jadwal operasional",
  ABSENCES_MATERIALIZED: "Absensi otomatis malam hari",
};

export function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function avatarVariant(id: string): AvatarVariant {
  const variants: AvatarVariant[] = ["av-pine", "av-amber", "av-slate", "av-rose"];
  const total = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return variants[total % variants.length] ?? "av-pine";
}

export function photoTone(id: string): PhotoTone {
  const variants: PhotoTone[] = ["photo-one", "photo-two", "photo-three", "photo-four"];
  const total = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return variants[total % variants.length] ?? "photo-one";
}

export function daysBetween(from: string, to: string) {
  return Math.ceil(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

export function dateDuration(start: string, end: string) {
  const count = Math.max(1, daysBetween(start, end) + 1);
  return `${count} hari`;
}

/** Escape LIKE wildcards so server-side ilike mirrors String.includes exactly. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Resolve participant ids matching client-side filters (name/NIM/institution).
 * Returns null when every participant matches (no server predicate needed).
 */
export function matchingParticipantIds(
  participants: AdminParticipant[],
  predicate: (participant: AdminParticipant) => boolean,
): string[] | null {
  const ids = participants.filter(predicate).map((participant) => participant.id);
  if (ids.length === 0) return [];
  return ids.length === participants.length ? null : ids;
}

export async function operationalContext(): Promise<OperationalContext> {
  const { data, error } = await supabase.rpc("operational_context");
  if (error) throw normalizeError(error);
  const context = data as OperationalContext;
  if (!context?.serverNow || !context?.operationalDate) {
    throw normalizeError(new Error("INVALID_CLOCK"));
  }
  return context;
}

export async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      const context = "context" in error ? (error.context as Response | undefined) : undefined;
      if (context) {
        const payload = (await context
          .clone()
          .json()
          .catch(() => null)) as { error?: { code?: string } } | null;
        if (payload?.error?.code) throw new AdminApiError(payload.error.code);
      }
      throw normalizeError(error);
    }
    return data as T;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function signedUrl(
  bucket: "attendance-photos" | "leave-attachments" | "avatars",
  path: string,
) {
  const response = await invoke<{ success: true; signedUrl: string }>("create-signed-url", {
    bucket,
    path,
  });
  return response.signedUrl;
}
