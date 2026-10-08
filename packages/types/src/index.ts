/**
 * @presensia/types — domain types only (PRD §8 role, §13 status, §20 form, §23 entitas).
 * Tidak ada business logic / fetch / backend di sini.
 */

/** PRD §8 — dua role MVP. */
export type UserRole = "participant" | "admin";

/** PRD §13.1 — status kehadiran permanen di database. */
export type AttendanceStatus = "HADIR" | "TERLAMBAT" | "IZIN" | "SAKIT" | "TIDAK_HADIR";

/** PRD §13.1 — status tampilan dashboard, bukan nilai DB. */
export type AttendanceDisplayStatus = AttendanceStatus | "BELUM_HADIR";

/** PRD §13.2 — siklus pengajuan izin/sakit. */
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/** PRD §20.3 / §23.7 — tipe pengajuan. */
export type LeaveRequestType = "IZIN" | "SAKIT";

/** PRD §23.4 — kategori peserta. */
export type ParticipantType = "SMK_PKL" | "UNIVERSITY_INTERN";

/** PRD §23.3 — jenis institusi. */
export type InstitutionType = "SMK" | "UNIVERSITY";

export type AttendanceSource = "CHECK_IN" | "LEAVE" | "ADMIN_CORRECTION";

/** PRD §23.2 — profil akun (kolom sensitif penuh ada di DB, bukan di sini). */
export interface Profile {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string | null;
  avatarPath: string | null;
  isActive: boolean;
}

/** PRD §23.3 — institusi. */
export interface Institution {
  id: string;
  name: string;
  institutionType: InstitutionType;
  city: string | null;
  isActive: boolean;
}

/** PRD §23.4 — hubungan peserta dengan program PKL/magang. */
export interface Internship {
  id: string;
  participantId: string;
  institutionId: string;
  participantType: ParticipantType;
  studentNumber: string;
  major: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/** PRD §23.5 — record kehadiran (bentuk baca, bukan kontrak tulis backend). */
export interface AttendanceRecord {
  id: string;
  participantId: string;
  internshipId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  leaveRequestId: string | null;
  checkInAt: string | null;
  checkInPhotoPath: string | null;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkInAccuracyMeters: number | null;
  checkInDistanceMeters: number | null;
  lateMinutes: number;
  checkOutAt: string | null;
  checkOutPhotoPath: string | null;
  correctedAt: string | null;
  correctedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** PRD §23.6 — jurnal harian. */
export interface Journal {
  id: string;
  participantId: string;
  internshipId: string;
  attendanceId: string | null;
  journalDate: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** PRD §23.7 — pengajuan izin/sakit. */
export interface LeaveRequest {
  id: string;
  participantId: string;
  internshipId: string;
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentPath: string | null;
  status: LeaveRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** PRD §23.8 — pengaturan presensi (bentuk baca). */
export interface AttendanceSettings {
  id: string;
  timezone: string;
  workDays: number[];
  checkInTime: string;
  lateToleranceMinutes: number;
  checkOutTime: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxLocationAccuracyMeters: number;
  requireCheckoutPhoto: boolean;
  maxJournalLength: number;
  updatedBy: string | null;
  updatedAt: string;
}

/** PRD §23.9 — audit log (bentuk baca). */
export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

export type ApiErrorResponse<Code extends string = string> = {
  success: false;
  error: { code: Code; message: string };
};

export type CheckInRequest = {
  photoPath: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export type CheckInResponse = {
  success: true;
  attendance: {
    id: string;
    date: string;
    checkInAt: string;
    status: "HADIR" | "TERLAMBAT";
    lateMinutes: number;
    distanceMeters: number;
  };
};

export type CheckOutRequest = {
  journalContent?: string;
  photoPath?: string;
};

export type CheckOutResponse = {
  success: true;
  attendance: { id: string; date: string; checkOutAt: string };
};
