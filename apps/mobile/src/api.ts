import type {
  AttendanceStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  ParticipantType,
} from "@presensia/types";
import type { DocumentPickerAsset } from "expo-document-picker";
import { MobileApiError, monthBounds } from "./format";
import { supabase } from "./supabase";

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_path: string | null;
  is_active: boolean;
};

export type InternshipRow = {
  id: string;
  participant_id: string;
  institution_id: string;
  participant_type: ParticipantType;
  student_number: string;
  major: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export type InstitutionRow = {
  id: string;
  name: string;
  institution_type: "SMK" | "UNIVERSITY";
  city: string | null;
};

export type SettingsRow = {
  timezone: string;
  work_days: number[];
  check_in_time: string;
  late_tolerance_minutes: number;
  check_out_time: string;
  location_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  max_location_accuracy_meters: number;
  require_checkout_photo: boolean;
  max_journal_length: number;
};

export type PolicySnapshot = {
  timezone?: string;
  workDays?: number[];
  checkInTime?: string;
  checkOutTime?: string;
  lateToleranceMinutes?: number;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  maxAccuracyMeters?: number;
  autoAbsence?: boolean;
} | null;

export type AttendanceRow = {
  id: string;
  participant_id: string;
  internship_id: string;
  leave_request_id: string | null;
  attendance_date: string;
  status: AttendanceStatus;
  source: "CHECK_IN" | "LEAVE" | "ADMIN_CORRECTION";
  check_in_at: string | null;
  check_in_photo_path: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy_m: number | null;
  check_in_distance_m: number | null;
  late_minutes: number;
  check_out_at: string | null;
  check_out_photo_path: string | null;
  early_checkout_minutes: number;
  work_duration_minutes: number | null;
  policy_snapshot: PolicySnapshot;
  corrected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalRow = {
  id: string;
  participant_id: string;
  internship_id: string;
  attendance_id: string | null;
  journal_date: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type JournalRevisionRow = {
  id: string;
  journal_id: string;
  participant_id: string;
  content: string;
  revision_no: number;
  created_at: string;
};

export type LeaveRow = {
  id: string;
  participant_id: string;
  internship_id: string;
  type: LeaveRequestType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_path: string | null;
  status: LeaveRequestStatus;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
};

export type ParticipantContext = {
  profile: ProfileRow;
  internship: InternshipRow | null;
  institution: InstitutionRow | null;
  settings: SettingsRow;
};

export async function getParticipantContext(): Promise<ParticipantContext> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user)
    throw new MobileApiError("UNAUTHORIZED", "Sesi telah berakhir. Silakan masuk kembali.");

  const [profileResult, internshipResult, settingsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email,phone,avatar_path,is_active")
      .eq("id", userData.user.id)
      .single(),
    supabase
      .from("internships")
      .select(
        "id,participant_id,institution_id,participant_type,student_number,major,start_date,end_date,is_active",
      )
      .eq("participant_id", userData.user.id)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("attendance_settings")
      .select(
        "timezone,work_days,check_in_time,late_tolerance_minutes,check_out_time,location_name,latitude,longitude,radius_meters,max_location_accuracy_meters,require_checkout_photo,max_journal_length",
      )
      .single(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (internshipResult.error) throw internshipResult.error;
  if (settingsResult.error) throw settingsResult.error;

  let institution: InstitutionRow | null = null;
  if (internshipResult.data) {
    const result = await supabase
      .from("institutions")
      .select("id,name,institution_type,city")
      .eq("id", internshipResult.data.institution_id)
      .single();
    if (result.error) throw result.error;
    institution = result.data as InstitutionRow;
  }

  // Jadwal efektif peserta (override per-institusi bila ada; fallback global).
  // Tanpa ini, peserta berjadwal khusus (mis. UNPAM) melihat & dibatasi
  // jadwal global yang salah.
  let settings = settingsResult.data as SettingsRow;
  if (internshipResult.data) {
    const { data: sched, error: schedError } = await supabase.rpc("my_schedule");
    if (!schedError && sched) {
      const s = sched as {
        workDays?: number[];
        checkIn?: string;
        checkOut?: string;
        tolerance?: number;
      };
      settings = {
        ...settings,
        work_days: Array.isArray(s.workDays) ? s.workDays : settings.work_days,
        check_in_time: typeof s.checkIn === "string" ? s.checkIn : settings.check_in_time,
        check_out_time: typeof s.checkOut === "string" ? s.checkOut : settings.check_out_time,
        late_tolerance_minutes:
          typeof s.tolerance === "number" ? s.tolerance : settings.late_tolerance_minutes,
      };
    }
  }

  return {
    profile: profileResult.data as ProfileRow,
    internship: internshipResult.data as InternshipRow | null,
    institution,
    settings,
  };
}

export async function getOperationalDate() {
  const { data, error } = await supabase.rpc("operational_date");
  if (error) throw error;
  return String(data);
}

export async function getTodayData() {
  const date = await getOperationalDate();
  const [context, attendanceResult, journalResult, leaveResult] = await Promise.all([
    getParticipantContext(),
    supabase.from("attendance_records").select("*").eq("attendance_date", date).maybeSingle(),
    supabase.from("journals").select("*").eq("journal_date", date).maybeSingle(),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "APPROVED")
      .lte("start_date", date)
      .gte("end_date", date)
      .maybeSingle(),
  ]);
  if (attendanceResult.error) throw attendanceResult.error;
  if (journalResult.error) throw journalResult.error;
  if (leaveResult.error) throw leaveResult.error;
  return {
    date,
    context,
    attendance: attendanceResult.data as AttendanceRow | null,
    journal: journalResult.data as JournalRow | null,
    leave: leaveResult.data as LeaveRow | null,
  };
}

export async function getAttendanceMonth(monthKey: string) {
  const { start, nextMonth } = monthBounds(monthKey);
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .gte("attendance_date", start)
    .lt("attendance_date", nextMonth)
    .order("attendance_date", { ascending: false });
  if (error) throw error;
  return data as AttendanceRow[];
}

export async function getAttendanceDetail(id: string) {
  const { data: attendance, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: journal, error: journalError } = await supabase
    .from("journals")
    .select("*")
    .eq("participant_id", attendance.participant_id)
    .eq("journal_date", attendance.attendance_date)
    .maybeSingle();
  if (journalError) throw journalError;
  return { attendance: attendance as AttendanceRow, journal: journal as JournalRow | null };
}

export async function getJournals(monthKey?: string) {
  let query = supabase.from("journals").select("*").order("journal_date", { ascending: false });
  if (monthKey) {
    const { start, nextMonth } = monthBounds(monthKey);
    query = query.gte("journal_date", start).lt("journal_date", nextMonth);
  } else {
    query = query.limit(100);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as JournalRow[];
}

export async function getJournalRevisions(journalId: string) {
  const { data, error } = await supabase
    .from("journal_revisions")
    .select("*")
    .eq("journal_id", journalId)
    .order("revision_no", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as JournalRevisionRow[];
}

export function newOperationId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function saveTodayJournal(content: string, operationId: string) {
  const trimmed = content.trim();
  if (!trimmed)
    throw new MobileApiError("EMPTY_JOURNAL", "Isi jurnal terlebih dahulu sebelum menyimpan.");
  const { data, error } = await supabase.rpc("save_journal", {
    p_operation_id: operationId,
    p_content: trimmed,
  });
  if (error) throw mapRpcError(error);
  return data as JournalRow;
}

function mapRpcError(error: { message?: string }) {
  const code = error.message?.match(/[A-Z][A-Z_]+/)?.[0];
  if (code === "LEAVE_OVERLAP")
    return new MobileApiError(code, "Rentang tanggal bertabrakan dengan pengajuan aktif lainnya.");
  if (code === "ATTENDANCE_ALREADY_EXISTS")
    return new MobileApiError(code, "Kehadiran pada salah satu tanggal sudah tercatat.");
  if (code === "OPERATION_IN_PROGRESS")
    return new MobileApiError(
      code,
      "Permintaan sebelumnya masih diproses. Tunggu sebentar lalu coba lagi.",
    );
  return error;
}

export async function getLeaveRequests() {
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as LeaveRow[];
}

type UploadAsset = { uri: string; name: string; mimeType?: string | null };

function objectId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function uploadAsset(bucket: string, path: string, asset: UploadAsset, maxBytes: number) {
  const response = await fetch(asset.uri);
  if (!response.ok)
    throw new MobileApiError("FILE_READ_FAILED", "File tidak dapat dibaca dari perangkat.");
  const body = await response.arrayBuffer();
  if (body.byteLength === 0)
    throw new MobileApiError("FILE_READ_FAILED", "File tidak dapat dibaca dari perangkat.");
  if (body.byteLength > maxBytes)
    throw new MobileApiError(
      "FILE_TOO_LARGE",
      "Ukuran file melebihi batas yang diizinkan. Perkecil file lalu coba lagi.",
    );
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: asset.mimeType ?? "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

function extension(name: string, fallback: string) {
  const matched = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched?.[1] ?? fallback;
}

export async function submitLeave(
  input: {
    type: LeaveRequestType;
    startDate: string;
    endDate: string;
    reason: string;
    operationId: string;
  },
  attachment: DocumentPickerAsset | null,
) {
  const context = await getParticipantContext();
  if (!context.internship?.is_active)
    throw new MobileApiError("INTERNSHIP_INACTIVE", "Periode program sedang tidak aktif.");
  let attachmentPath: string | null = null;
  if (attachment) {
    const ext = extension(attachment.name, "").toLowerCase();
    const allowed = new Set(["jpg", "jpeg", "png", "pdf"]);
    if (!allowed.has(ext))
      throw new MobileApiError(
        "INVALID_FILE_TYPE",
        "Lampiran harus berupa JPG, PNG, atau PDF dengan ukuran maksimal 5 MB.",
      );
    attachmentPath = `${context.profile.id}/leave/${objectId()}.${ext}`;
    await uploadAsset("leave-attachments", attachmentPath, attachment, 5 * 1024 * 1024);
  }
  // Never delete the upload here: if the request committed but the response
  // was lost, the path is referenced evidence. Orphans are reclaimed
  // server-side after the grace period.
  const { data, error } = await supabase.rpc("submit_leave_request", {
    p_operation_id: input.operationId,
    p_internship_id: context.internship.id,
    p_type: input.type,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_reason: input.reason.trim(),
    p_attachment_path: attachmentPath,
  });
  if (error) throw mapRpcError(error);
  return data as LeaveRow;
}

async function invoke<T>(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const context = "context" in error ? (error.context as Response | undefined) : undefined;
    if (context) {
      const payload = (await context
        .clone()
        .json()
        .catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (payload?.error?.code)
        throw new MobileApiError(payload.error.code, payload.error.message ?? payload.error.code);
    }
    throw error;
  }
  return data as T;
}

export async function checkIn(input: {
  photoUri: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  operationId: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new MobileApiError("UNAUTHORIZED", "Sesi telah berakhir.");
  const date = await getOperationalDate();
  const path = `${userData.user.id}/${date}/check-in-${objectId()}.jpg`;
  await uploadAsset(
    "attendance-photos",
    path,
    { uri: input.photoUri, name: "selfie.jpg", mimeType: "image/jpeg" },
    5 * 1024 * 1024,
  );
  // Never delete the upload on failure: a lost response may hide a committed
  // record that references this photo. Orphans are reclaimed server-side.
  const response = await invoke<{
    success: true;
    attendance: {
      id: string;
      date: string;
      checkInAt: string;
      status: AttendanceStatus;
      lateMinutes: number;
      distanceMeters: number;
    };
  }>("check-in", {
    photoPath: path,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    operationId: input.operationId,
  });
  return response.attendance;
}

export async function checkOut(input: {
  journalContent?: string;
  photo?: { uri: string } | null;
  operationId: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new MobileApiError("UNAUTHORIZED", "Sesi telah berakhir.");
  const date = await getOperationalDate();
  let photoPath: string | undefined;
  if (input.photo) {
    photoPath = `${userData.user.id}/${date}/check-out-${objectId()}.jpg`;
    await uploadAsset(
      "attendance-photos",
      photoPath,
      { uri: input.photo.uri, name: "checkout.jpg", mimeType: "image/jpeg" },
      5 * 1024 * 1024,
    );
  }
  const response = await invoke<{
    success: true;
    attendance: { id: string; date: string; checkOutAt: string };
  }>("check-out", {
    journalContent: input.journalContent?.trim() || undefined,
    photoPath,
    operationId: input.operationId,
  });
  return response.attendance;
}

export async function getSignedUrl(bucket: string, path: string) {
  const response = await invoke<{ success: true; signedUrl: string }>("create-signed-url", {
    bucket,
    path,
  });
  return response.signedUrl;
}
