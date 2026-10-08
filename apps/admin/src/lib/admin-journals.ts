import type {
  AdminJournal,
  AdminJournalRevision,
  AdminParticipant,
  JournalFilter,
} from "./admin-api";
import { AdminApiError, normalizeError } from "./errors";
import { formatDate, formatTime, formatTimestamp, monthBounds } from "./format";
import { supabase } from "./supabase";
import { participantIndex } from "./admin-participants";
import type { RawAttendance, RawJournal } from "./admin-shared";
import { ATTENDANCE_STATUS_LABEL, escapeLike, matchingParticipantIds } from "./admin-shared";

export function mapJournal(
  raw: RawJournal,
  participant: AdminParticipant,
  attendance?: RawAttendance | null,
): AdminJournal {
  const start = formatTime(attendance?.check_in_at ?? null) ?? "-";
  const end = formatTime(attendance?.check_out_at ?? null) ?? "-";
  return {
    id: raw.id,
    participantId: raw.participant_id,
    participant,
    attendanceId: raw.attendance_id,
    journalDate: raw.journal_date,
    dateLabel: formatDate(raw.journal_date),
    timeLabel: formatTime(raw.updated_at, true) ?? "-",
    excerpt: raw.content.length > 72 ? `${raw.content.slice(0, 72)}...` : raw.content,
    content: raw.content,
    charCount: raw.content.length,
    createdLabel: formatTimestamp(raw.created_at),
    updatedLabel: formatTimestamp(raw.updated_at),
    attendanceLabel: attendance
      ? `${start}-${end} · ${ATTENDANCE_STATUS_LABEL[attendance.status]}`
      : "Tidak terkait kehadiran",
  };
}

export async function journals(filter: JournalFilter, page: number, perPage: number) {
  const { start, next } = monthBounds(filter.month);
  const { byId, participants } = await participantIndex();
  const query = filter.query.trim();
  const q = query.toLowerCase();
  // Institution scope first; name/content matching stays inside it.
  const poolIds = matchingParticipantIds(
    participants,
    (participant) =>
      (filter.showInactive === true || participant.isActive) &&
      (filter.institution === "all" || participant.institutionId === filter.institution),
  );
  if (poolIds !== null && poolIds.length === 0) return { rows: [], total: 0 };
  const pool = poolIds ?? participants.map((participant) => participant.id);
  const nameIds = query
    ? pool.filter((id) => byId.get(id)?.name.toLowerCase().includes(q) ?? false)
    : null;
  let request = supabase
    .from("journals")
    .select("*", { count: "exact" })
    .gte("journal_date", start)
    .lt("journal_date", next)
    .order("journal_date", { ascending: false })
    .order("id", { ascending: false });
  if (!query) {
    if (poolIds) request = request.in("participant_id", poolIds);
  } else if (nameIds !== null && nameIds.length >= pool.length) {
    // Every journal in scope matches by participant name; pool scope suffices.
    if (poolIds) request = request.in("participant_id", poolIds);
  } else {
    // Content matches resolved server-side (id-only). Both id sets hold
    // UUIDs only, so the .or() below never meets parsing-hazard chars.
    let contentRequest = supabase
      .from("journals")
      .select("id")
      .gte("journal_date", start)
      .lt("journal_date", next)
      .ilike("content", `%${escapeLike(query)}%`);
    if (poolIds) contentRequest = contentRequest.in("participant_id", poolIds);
    const contentResult = await contentRequest;
    if (contentResult.error) throw normalizeError(contentResult.error);
    const contentIds = ((contentResult.data ?? []) as { id: string }[]).map((row) => row.id);
    const hasName = (nameIds ?? []).length > 0;
    if (!hasName && contentIds.length === 0) return { rows: [], total: 0 };
    request =
      hasName && contentIds.length > 0
        ? request.or(
            `participant_id.in.(${(nameIds ?? []).join(",")}),id.in.(${contentIds.join(",")})`,
          )
        : hasName
          ? request.in("participant_id", nameIds ?? [])
          : request.in("id", contentIds);
  }
  const from = (page - 1) * perPage;
  const { data, error, count } = await request.range(from, from + perPage - 1);
  if (error) throw normalizeError(error);
  const rawJournals = (data as RawJournal[]).filter((raw) => byId.has(raw.participant_id));
  // Attendance links resolved for the page only (month-wide fetch could
  // exceed PostgREST max_rows and silently drop rows).
  const attendanceIds = [
    ...new Set(rawJournals.map((raw) => raw.attendance_id).filter(Boolean)),
  ] as string[];
  const attendanceById = new Map<string, RawAttendance>();
  if (attendanceIds.length) {
    const attendanceResult = await supabase
      .from("attendance_records")
      .select("*")
      .in("id", attendanceIds);
    if (attendanceResult.error) throw normalizeError(attendanceResult.error);
    for (const row of (attendanceResult.data ?? []) as RawAttendance[])
      attendanceById.set(row.id, row);
  }
  const rows = rawJournals.map((raw) => {
    const participant = byId.get(raw.participant_id);
    if (!participant) throw new AdminApiError("PARTICIPANT_NOT_FOUND");
    return mapJournal(raw, participant, attendanceById.get(raw.attendance_id ?? "") ?? null);
  });
  if (rows.length) {
    const ids = rows.map((row) => row.id);
    const revisionsResult = await supabase
      .from("journal_revisions")
      .select("journal_id,revision_no,content,created_at")
      .in("journal_id", ids)
      .order("revision_no", { ascending: false });
    if (revisionsResult.error) throw normalizeError(revisionsResult.error);
    const byJournal = new Map<string, AdminJournalRevision[]>();
    for (const row of revisionsResult.data ?? []) {
      const list = byJournal.get(row.journal_id) ?? [];
      list.push({
        revisionNo: row.revision_no,
        content: row.content,
        createdLabel: formatTimestamp(row.created_at),
      });
      byJournal.set(row.journal_id, list);
    }
    for (const row of rows) row.revisions = byJournal.get(row.id) ?? [];
  }
  return { rows, total: count ?? 0 };
}
