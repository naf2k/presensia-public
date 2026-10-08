import type { AttendanceDisplayStatus } from "@presensia/types";
import type { AdminAttendance } from "./admin-api";
import { normalizeError } from "./errors";
import { formatDate } from "./format";
import { supabase } from "./supabase";
import { participantIndex } from "./admin-participants";
import { mapAttendance } from "./admin-attendance";
import type { RawAttendance } from "./admin-shared";
import { operationalContext, photoTone } from "./admin-shared";

export async function dashboard() {
  const [context, { date, participants }] = await Promise.all([
    operationalContext(),
    participantIndex(),
  ]);
  const active = participants.filter(
    (participant) =>
      participant.isActive && participant.periodStart <= date && participant.periodEnd >= date,
  );
  const [{ data: attendanceData, error: attendanceError }, pendingResult, settingsResult] =
    await Promise.all([
      supabase.from("attendance_records").select("*").eq("attendance_date", date),
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING"),
      supabase.from("attendance_settings").select("*").single(),
    ]);
  if (attendanceError) throw normalizeError(attendanceError);
  if (pendingResult.error) throw normalizeError(pendingResult.error);
  if (settingsResult.error) throw normalizeError(settingsResult.error);
  const records = attendanceData as RawAttendance[];
  const byParticipant = new Map(records.map((record) => [record.participant_id, record]));
  const rows = active.map((participant): AdminAttendance => {
    const record = byParticipant.get(participant.id);
    if (record) return mapAttendance(record, participant, null);
    return {
      id: `belum-${participant.id}`,
      recordId: null,
      participantId: participant.id,
      participant,
      attendanceDate: date,
      dateLabel: formatDate(date),
      weekdayLabel: null,
      checkIn: null,
      checkOut: null,
      checkInAt: null,
      checkOutAt: null,
      status: "BELUM_HADIR",
      lateMinutes: 0,
      earlyCheckoutMinutes: 0,
      workDurationMinutes: null,
      autoAbsence: false,
      photoTone: photoTone(participant.id),
      checkInPhotoPath: null,
      checkOutPhotoPath: null,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      distanceMeters: null,
      corrected: false,
      hasJournal: false,
      journalState: "Belum diisi",
      journal: null,
      note: null,
    };
  });
  const statusCount = (status: AttendanceDisplayStatus) =>
    rows.filter((row) => row.status === status).length;
  const lateRows = records.filter((record) => record.status === "TERLAMBAT");
  return {
    date,
    serverNow: context.serverNow,
    isWorkDay: context.isWorkDay,
    rows,
    summary: {
      active: active.length,
      hadir: statusCount("HADIR"),
      terlambat: statusCount("TERLAMBAT"),
      izinSakit: statusCount("IZIN") + statusCount("SAKIT"),
      belumHadir: statusCount("BELUM_HADIR"),
      pendingLeaves: pendingResult.count ?? 0,
      endingSoon: active.filter((participant) => participant.endingSoon).length,
      averageLate: lateRows.length
        ? Math.round(
            lateRows.reduce((sum, record) => sum + record.late_minutes, 0) / lateRows.length,
          )
        : 0,
    },
    settings: settingsResult.data,
  };
}
