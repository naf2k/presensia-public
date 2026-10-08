import type {
  AttendanceDisplayStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  ParticipantType,
} from "@presensia/types";

export type AvatarVariant = "av-pine" | "av-amber" | "av-slate" | "av-rose";
export type PhotoTone = "photo-one" | "photo-two" | "photo-three" | "photo-four";

export interface AdminParticipant {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarPath: string | null;
  studentNumber: string;
  participantType: ParticipantType;
  category: "SMK PKL" | "Mahasiswa Magang";
  institutionId: string;
  institution: string;
  institutionShort: string;
  institutionType: "SMK" | "UNIVERSITY";
  major: string;
  majorShort: string;
  city: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  remainingLabel: string;
  isActive: boolean;
  endingSoon: boolean;
  avatarVariant: AvatarVariant;
  updatedAt: string;
}

export interface AdminAttendance {
  id: string;
  recordId: string | null;
  participantId: string;
  participant: AdminParticipant;
  attendanceDate: string;
  dateLabel: string;
  weekdayLabel: string | null;
  checkIn: string | null;
  checkOut: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: AttendanceDisplayStatus;
  lateMinutes: number;
  earlyCheckoutMinutes: number;
  workDurationMinutes: number | null;
  autoAbsence: boolean;
  photoTone: PhotoTone;
  checkInPhotoPath: string | null;
  checkOutPhotoPath: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  distanceMeters: number | null;
  corrected: boolean;
  hasJournal: boolean;
  journalState: "Terisi" | "Belum diisi";
  journal: AdminJournal | null;
  note: string | null;
}

export interface AdminJournal {
  id: string;
  participantId: string;
  participant: AdminParticipant;
  attendanceId: string | null;
  journalDate: string;
  dateLabel: string;
  timeLabel: string;
  excerpt: string;
  content: string;
  charCount: number;
  createdLabel: string;
  updatedLabel: string;
  attendanceLabel: string;
  revisions?: AdminJournalRevision[];
}

export interface AdminJournalRevision {
  revisionNo: number;
  content: string;
  createdLabel: string;
}

export interface AdminLeave {
  id: string;
  participantId: string;
  participant: AdminParticipant;
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  dateLabel: string;
  durationLabel: string;
  reasonShort: string;
  reasonFull: string;
  attachment: string | null;
  attachmentPath: string | null;
  status: LeaveRequestStatus;
  adminNote: string | null;
  submittedLabel: string;
}

export interface AdminAudit {
  id: string;
  createdAt: string;
  timeLabel: string;
  shortTimeLabel: string;
  actor: string;
  actorRole: string;
  actionCode: string;
  action: string;
  entityId: string;
  entityKind: string;
  reason: string;
  entityTable: string;
  participantName?: string;
  changeBefore?: string;
  changeAfter?: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}

export interface AdminSettings {
  workDays: boolean[];
  checkInTime: string;
  checkOutTime: string;
  lateTolerance: number;
  locationName: string;
  latitude: string;
  longitude: string;
  radius: number;
  maxLocationAccuracyMeters: number;
  requireCheckoutPhoto: boolean;
  maxJournalLength: number;
  updatedLabel: string;
}

export interface InstitutionOption {
  id: string;
  name: string;
  type: "SMK" | "UNIVERSITY";
  city: string | null;
}

export interface AdminInstitution {
  id: string;
  name: string;
  type: "SMK" | "UNIVERSITY";
  typeLabel: string;
  city: string | null;
  isActive: boolean;
  activeInternships: number;
  totalInternships: number;
  scheduleSummary: string | null;
}

export interface InstitutionInput {
  id?: string;
  name: string;
  type: "SMK" | "UNIVERSITY";
  city: string;
  isActive: boolean;
}

export interface ParticipantFilter {
  query: string;
  category: string;
  institution: string;
  status: string;
  period: string;
}

export interface AttendanceFilter {
  query: string;
  status: string;
  institution: string;
  dateFrom: string;
  dateTo: string;
  showInactive?: boolean;
}

export interface JournalFilter {
  query: string;
  month: string;
  institution: string;
  showInactive?: boolean;
}

export interface LeaveFilter {
  status: LeaveRequestStatus;
  query: string;
  type: string;
  month: string;
  showInactive?: boolean;
}

export interface AuditFilter {
  query: string;
  action: string;
  date: string;
}

export interface ParticipantInput {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  institutionId: string;
  participantType: ParticipantType;
  studentNumber: string;
  major: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  reason?: string;
  avatar?: File | null;
  password?: string;
}

export type OperationalContext = {
  serverNow: string;
  operationalDate: string;
  timezone: string;
  isWorkDay: boolean;
  checkInTime: string;
  checkOutTime: string;
  lateToleranceMinutes: number;
};

export type { ImportBatchInput, ImportBatchResult } from "./admin-participants";
export type { InstitutionDaySchedule } from "./admin-schedules";
export { WEEKDAY_LABEL } from "./admin-schedules";

// Facade: the public interface stays exactly as before (pages import types
// from here and call adminApi via queries.ts). Implementations live in
// per-domain modules; shared plumbing in admin-shared.
import { operationalContext, signedUrl } from "./admin-shared";
import {
  attendance,
  attendanceDetail,
  closeDay,
  createAttendance,
  saveCorrection,
} from "./admin-attendance";
import { dashboard } from "./admin-dashboard";
import { auditLogs } from "./admin-audit";
import { institutions, institutionsAll, saveInstitution } from "./admin-institutions";
import {
  listSchedules,
  saveSchedules,
  scheduleSummary,
  WEEKDAY_LABEL,
} from "./admin-schedules";
import { journals } from "./admin-journals";
import { leaves, reviewLeave } from "./admin-leaves";
import {
  importParticipants,
  participant,
  participants,
  saveParticipant,
  uploadAvatar,
} from "./admin-participants";
import {
  addHoliday,
  cleanupOrphans,
  holidays,
  removeHoliday,
  saveSettings,
  settings,
} from "./admin-settings";

export const adminApi = {
  operationalContext,
  institutions,
  institutionsAll,
  saveInstitution,
  listSchedules,
  saveSchedules,
  scheduleSummary,
  WEEKDAY_LABEL,
  dashboard,
  participants,
  participant,
  importParticipants,
  attendance,
  attendanceDetail,
  journals,
  leaves,
  auditLogs,
  settings,
  saveSettings,
  reviewLeave,
  saveCorrection,
  createAttendance,
  closeDay,
  holidays,
  addHoliday,
  removeHoliday,
  cleanupOrphans,
  saveParticipant,
  uploadAvatar,
  signedUrl,
};
