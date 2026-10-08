/**
 * @presensia/constants — enums, defaults, dan token (PRD §13, §21.2, §23.8, §26.2).
 * Nilai default bertanda "perlu konfirmasi Diskominfo" mengikuti PRD.
 */
import type {
  AttendanceDisplayStatus,
  AttendanceStatus,
  InstitutionType,
  LeaveRequestStatus,
  LeaveRequestType,
  ParticipantType,
  UserRole,
} from "@presensia/types";

export const APP_TIMEZONE = "Asia/Jakarta" as const;

export const USER_ROLES: readonly UserRole[] = ["participant", "admin"] as const;

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "HADIR",
  "TERLAMBAT",
  "IZIN",
  "SAKIT",
  "TIDAK_HADIR",
] as const;

export const ATTENDANCE_DISPLAY_STATUSES: readonly AttendanceDisplayStatus[] = [
  ...ATTENDANCE_STATUSES,
  "BELUM_HADIR",
] as const;

export const LEAVE_REQUEST_STATUSES: readonly LeaveRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export const LEAVE_REQUEST_TYPES: readonly LeaveRequestType[] = ["IZIN", "SAKIT"] as const;

export const PARTICIPANT_TYPES: readonly ParticipantType[] = [
  "SMK_PKL",
  "UNIVERSITY_INTERN",
] as const;

export const INSTITUTION_TYPES: readonly InstitutionType[] = ["SMK", "UNIVERSITY"] as const;

/**
 * Default operasional awal — PRD FR-004/FR-005/FR-018.
 * Bukan keputusan final; admin dapat mengubah via pengaturan (tahap backend).
 */
export const ATTENDANCE_DEFAULTS = {
  checkInTime: "08:00",
  lateToleranceMinutes: 15,
  checkOutTime: "16:00",
  radiusMeters: 150,
  requireCheckoutPhoto: false,
  maxJournalLength: 500,
  workDays: [1, 2, 3, 4, 5],
  timezone: APP_TIMEZONE,
} as const;

/** PRD §20 — batas validasi form (cerminan, bukan implementasi form). */
export const FORM_LIMITS = {
  fullName: { min: 2, max: 100 },
  studentNumber: { min: 2, max: 50 },
  major: { min: 2, max: 100 },
  journal: { min: 1, max: 500 },
  leaveReason: { min: 5, max: 500 },
  pageSizes: [20, 50, 100],
  defaultPageSize: 20,
} as const;

/** PRD §21.2 — color system (single source of truth untuk web & mobile). */
export const COLOR_TOKENS = {
  primary: "#B85C42",
  secondary: "#74866A",
  background: "#F7F4EF",
  surface: "#FFFFFF",
  textPrimary: "#252421",
  textMuted: "#77736D",
  success: "#52705A",
  warning: "#D58A32",
  danger: "#C34F4F",
} as const;

/** PRD §26.2 — error codes kontrak check-in (daftar saja, tanpa handler). */
export const CHECK_IN_ERROR_CODES = [
  "UNAUTHORIZED",
  "ACCOUNT_INACTIVE",
  "INTERNSHIP_INACTIVE",
  "NOT_WORK_DAY",
  "ALREADY_CHECKED_IN",
  "LOCATION_OUTSIDE_RADIUS",
  "LOCATION_ACCURACY_TOO_LOW",
  "PHOTO_REQUIRED",
  "INTERNAL_ERROR",
] as const;

export type CheckInErrorCode = (typeof CHECK_IN_ERROR_CODES)[number];

export const CHECK_OUT_ERROR_CODES = [
  "UNAUTHORIZED",
  "ACCOUNT_INACTIVE",
  "ATTENDANCE_NOT_FOUND",
  "ALREADY_CHECKED_OUT",
  "CHECKOUT_PHOTO_REQUIRED",
  "PHOTO_REQUIRED",
  "JOURNAL_TOO_LONG",
  "INTERNAL_ERROR",
] as const;

export type CheckOutErrorCode = (typeof CHECK_OUT_ERROR_CODES)[number];

/** Nama bucket storage privat (PRD SEC-004) — tanpa kredensial. */
export const STORAGE_BUCKETS = {
  attendancePhotos: "attendance-photos",
  avatars: "avatars",
  leaveAttachments: "leave-attachments",
} as const;
