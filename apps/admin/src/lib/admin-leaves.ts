import type { AdminLeave, AdminParticipant, LeaveFilter } from "./admin-api";
import { normalizeError } from "./errors";
import { formatDate, formatTimestamp, monthBounds } from "./format";
import { supabase } from "./supabase";
import { participantIndex } from "./admin-participants";
import type { RawLeave } from "./admin-shared";
import { dateDuration, invoke } from "./admin-shared";

export function mapLeave(raw: RawLeave, participant: AdminParticipant): AdminLeave {
  return {
    id: raw.id,
    participantId: raw.participant_id,
    participant,
    type: raw.type,
    startDate: raw.start_date,
    endDate: raw.end_date,
    dateLabel:
      raw.start_date === raw.end_date
        ? formatDate(raw.start_date)
        : `${formatDate(raw.start_date)} - ${formatDate(raw.end_date)}`,
    durationLabel: dateDuration(raw.start_date, raw.end_date),
    reasonShort: raw.reason.length > 55 ? `${raw.reason.slice(0, 55)}...` : raw.reason,
    reasonFull: raw.reason,
    attachment: raw.attachment_path?.split("/").pop() ?? null,
    attachmentPath: raw.attachment_path,
    status: raw.status,
    adminNote: raw.admin_note,
    submittedLabel: `Diajukan ${formatTimestamp(raw.created_at)} WIB`,
  };
}

export async function leaves(filter: LeaveFilter) {
  const { start, next } = monthBounds(filter.month);
  const { byId } = await participantIndex();
  // Overlap: range intersects [start, next) so multi-month leaves show in every covered month.
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .lt("start_date", next)
    .gte("end_date", start)
    .order("created_at", { ascending: filter.status === "PENDING" });
  if (error) throw normalizeError(error);
  const all = (data as RawLeave[]).flatMap((raw) => {
    const participant = byId.get(raw.participant_id);
    return participant ? [mapLeave(raw, participant)] : [];
  });
  const query = filter.query.trim().toLowerCase();
  const visible = all.filter(
    (leave) => filter.showInactive === true || leave.participant.isActive,
  );
  const rows = visible.filter((leave) => {
    if (leave.status !== filter.status) return false;
    if (filter.type !== "all" && leave.type !== filter.type) return false;
    return (
      !query ||
      [leave.participant.name, leave.reasonFull, leave.id].some((value) =>
        value.toLowerCase().includes(query),
      )
    );
  });
  const counts = {
    PENDING: visible.filter((leave) => leave.status === "PENDING").length,
    APPROVED: visible.filter((leave) => leave.status === "APPROVED").length,
    REJECTED: visible.filter((leave) => leave.status === "REJECTED").length,
  };
  return { rows, counts };
}

export async function reviewLeave(
  id: string,
  decision: "APPROVED" | "REJECTED",
  adminNote: string,
) {
  return invoke("review-leave", {
    leaveRequestId: id,
    decision,
    adminNote: adminNote.trim() || undefined,
    operationId: crypto.randomUUID(),
  });
}
