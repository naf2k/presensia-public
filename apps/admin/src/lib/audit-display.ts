// Kamus tampil untuk jejak audit: kode teknis -> bahasa manusia.
// Murni presentasi; tidak mengubah data maupun perilaku backend.

export interface AuditDisplayRow {
  actionCode: string;
  action: string;
  entityKind: string;
  participantName?: string | null;
}

const ENTITY_LABELS: Record<string, string> = {
  attendance_settings: "Pengaturan presensi",
  profile: "Peserta",
  attendance: "Kehadiran",
  attendance_date: "Absensi harian",
  leave_request: "Pengajuan izin",
  holiday_calendar: "Hari libur",
  institution: "Institusi",
  internship: "Data magang",
};

export function humanizeEntityKind(kind: string): string {
  if (ENTITY_LABELS[kind]) return ENTITY_LABELS[kind];
  const words = kind.split("_").filter(Boolean);
  if (words.length === 0) return kind;
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

export function humanizeActionCode(code: string): string {
  return humanizeEntityKind(code.toLowerCase());
}

const SKIP_KEYS = new Set(["id", "singleton_key", "created_at", "updated_at", "updated_by"]);

const FIELD_LABELS: Record<string, string> = {
  location_name: "Nama lokasi",
  latitude: "Latitude",
  longitude: "Longitude",
  radius_meters: "Radius (m)",
  max_location_accuracy_meters: "Batas akurasi (m)",
  work_days: "Hari kerja",
  check_in_time: "Jam masuk",
  check_out_time: "Jam pulang",
  late_tolerance_minutes: "Toleransi (mnt)",
  require_checkout_photo: "Selfie check-out wajib",
  max_journal_length: "Maks. jurnal",
  timezone: "Zona waktu",
  full_name: "Nama",
  email: "Email",
  student_number: "NIS/NIM",
  major: "Jurusan",
  is_active: "Aktif",
  institution_id: "Institusi",
  holiday_date: "Tanggal",
  name: "Nama",
};

const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function parseYmd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
}

function formatWorkDays(days: number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return "—";
  const names = sorted.map((d) => DAY_SHORT[d % 7]);
  const consecutive =
    sorted.length > 1 && sorted.every((d, i) => i === 0 || d === (sorted[i - 1] ?? d - 1) + 1);
  const first = names[0] ?? "";
  const last = names[names.length - 1] ?? "";
  if (consecutive) return `${first}–${last}`;
  return names.join(", ");
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (key === "work_days" && Array.isArray(value)) {
    return formatWorkDays(value.filter((d): d is number => typeof d === "number"));
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value).slice(0, 80);
}

function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return humanizeEntityKind(key);
}

export interface ChangeItem {
  key: string;
  label: string;
  before: string;
  after: string;
}

/** Bandingkan before/after: hanya field yang berubah, tanpa kolom internal. */
export function diffChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): ChangeItem[] {
  if (!before && !after) return [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: ChangeItem[] = [];
  for (const key of keys) {
    if (SKIP_KEYS.has(key)) continue;
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    out.push({ key, label: fieldLabel(key), before: formatValue(key, b), after: formatValue(key, a) });
  }
  return out;
}

export function summarizeActivity(row: AuditDisplayRow): string {
  if (row.participantName && row.actionCode.startsWith("PARTICIPANT_")) {
    return `${row.action} ${row.participantName}`;
  }
  if (
    (row.actionCode === "LEAVE_APPROVED" ||
      row.actionCode === "LEAVE_REJECTED" ||
      row.actionCode === "ATTENDANCE_CORRECTED") &&
    row.participantName
  ) {
    return `${row.action} ${row.participantName}`;
  }
  if (row.action === "Aktivitas administratif") {
    return `${humanizeActionCode(row.actionCode)} · ${humanizeEntityKind(row.entityKind)}`;
  }
  if (row.actionCode === "ATTENDANCE_SETTINGS_UPDATED") {
    return row.action;
  }
  return row.action;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** Label kelompok tanggal (WIB): hari ini / kemarin / tanggal panjang. */
export function groupDayLabel(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return "Hari ini";
  const day = (iso: string) => {
    const [y, m, d] = parseYmd(iso);
    return new Date(Date.UTC(y, m - 1, d)).getTime();
  };
  if (day(todayYmd) - day(ymd) === 86_400_000) return "Kemarin";
  const [y, m, d] = parseYmd(ymd);
  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" }).format(
    new Date(Date.UTC(y, m - 1, d, 5)),
  );
  const rest = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Date.UTC(y, m - 1, d, 5)));
  return `${weekday}, ${rest}`;
}
