import type { AttendanceDisplayStatus, AttendanceStatus, LeaveRequestStatus } from "@presensia/types";
import { cn } from "@presensia/utils";

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  TIDAK_HADIR: "Tidak hadir",
};

const DISPLAY_LABEL: Record<AttendanceDisplayStatus, string> = {
  ...ATTENDANCE_LABEL,
  BELUM_HADIR: "Belum hadir",
};

const ATTENDANCE_CLASS: Record<AttendanceStatus, string> = {
  HADIR: "status-hadir",
  TERLAMBAT: "status-telat",
  IZIN: "status-izin",
  SAKIT: "status-izin",
  TIDAK_HADIR: "status-izin",
};

const DISPLAY_CLASS: Record<AttendanceDisplayStatus, string> = {
  ...ATTENDANCE_CLASS,
  BELUM_HADIR: "status-izin",
};

export function StatusBadge({
  status,
  lateMinutes,
  className,
}: {
  status: AttendanceDisplayStatus;
  lateMinutes?: number;
  className?: string;
}) {
  return (
    <span className={cn("status", DISPLAY_CLASS[status], className)}>
      <span className="dot" aria-hidden="true" />
      {DISPLAY_LABEL[status]}
      {status === "TERLAMBAT" && lateMinutes !== undefined && lateMinutes > 0 ? (
        <small>+{lateMinutes}m</small>
      ) : null}
    </span>
  );
}

const LEAVE_STATUS_LABEL: Record<LeaveRequestStatus, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

const LEAVE_STATUS_CLASS: Record<LeaveRequestStatus, string> = {
  PENDING: "badge-warning",
  APPROVED: "badge-success",
  REJECTED: "badge-danger",
};

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return (
    <span className={cn("badge", LEAVE_STATUS_CLASS[status])}>{LEAVE_STATUS_LABEL[status]}</span>
  );
}

const ATTENDANCE_BADGE_CLASS: Record<AttendanceStatus, string> = {
  HADIR: "badge-success",
  TERLAMBAT: "badge-warning",
  IZIN: "badge-neutral",
  SAKIT: "badge-neutral",
  TIDAK_HADIR: "badge-danger",
};

export function AttendanceBadge({ status }: { status: AttendanceDisplayStatus }) {
  return (
    <span className={cn("badge", status === "BELUM_HADIR" ? "badge-neutral" : ATTENDANCE_BADGE_CLASS[status])}>
      {DISPLAY_LABEL[status]}
    </span>
  );
}

export function LeaveTypeBadge({ type }: { type: "IZIN" | "SAKIT" }) {
  return (
    <span className={cn("badge", type === "IZIN" ? "badge-neutral" : "badge-danger")}>
      {type === "IZIN" ? "Izin" : "Sakit"}
    </span>
  );
}

export function ActiveBadge({ isActive, endingSoon }: { isActive: boolean; endingSoon?: boolean }) {
  if (!isActive) return <span className="badge badge-neutral">Nonaktif</span>;
  if (endingSoon) return <span className="badge badge-warning">Segera selesai</span>;
  return <span className="badge badge-success">Aktif</span>;
}
