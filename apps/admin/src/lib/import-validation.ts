export const MAX_IMPORT_ROWS = 100;

export interface ImportColumnIndex {
  nis: number;
  nama: number;
  jurusan: number;
  email: number;
  hp: number;
}

export interface ImportDraftRow {
  nis: string;
  nama: string;
  jurusan: string;
  email: string;
  hp: string;
}

const REQUIRED_COLUMNS = ["nis", "nama", "email"] as const;

function norm(value: unknown) {
  return String(value ?? "").trim();
}

export function mapImportHeader(header: unknown[]): ImportColumnIndex | { error: string } {
  const cells = header.map((cell) => norm(cell).toLowerCase());
  const find = (names: string[]) => cells.findIndex((cell) => names.some((n) => cell.includes(n)));
  const index = {
    nis: find(["nis", "nim", "nomor induk", "student"]),
    nama: find(["nama", "name", "full"]),
    jurusan: find(["jurusan", "major", "program studi", "prodi"]),
    email: find(["email", "mail", "surel"]),
    hp: find(["hp", "telepon", "phone", "no", "kontak", "wa"]),
  };
  const missing = REQUIRED_COLUMNS.filter((key) => index[key] < 0);
  if (missing.length) return { error: `Kolom wajib hilang: ${missing.join(", ")}.` };
  return index as ImportColumnIndex;
}

export function mapImportRows(raw: unknown[][], index: ImportColumnIndex): ImportDraftRow[] {
  return raw
    .filter((cells) => norm(cells[index.nis]) || norm(cells[index.nama]))
    .map((cells) => ({
      nis: norm(cells[index.nis]),
      nama: norm(cells[index.nama]),
      jurusan: norm(cells[index.jurusan]),
      email: norm(cells[index.email]),
      hp: norm(cells[index.hp]),
    }));
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Per-row error messages (empty string = valid). Never throws. */
export function validateImportRows(rows: ImportDraftRow[]): string[] {
  if (rows.length > MAX_IMPORT_ROWS)
    return rows.map(() => `Maksimal ${MAX_IMPORT_ROWS} baris per file.`);
  const emailCount = new Map<string, number>();
  const nisCount = new Map<string, number>();
  for (const row of rows) {
    if (row.email)
      emailCount.set(row.email.toLowerCase(), (emailCount.get(row.email.toLowerCase()) ?? 0) + 1);
    if (row.nis)
      nisCount.set(row.nis.toLowerCase(), (nisCount.get(row.nis.toLowerCase()) ?? 0) + 1);
  }
  return rows.map((row) => {
    const problems: string[] = [];
    if (row.nis.length < 2 || row.nis.length > 50) problems.push("NIS 2–50 karakter");
    if (row.nama.length < 2 || row.nama.length > 100) problems.push("Nama 2–100 karakter");
    if (row.jurusan.length < 2 || row.jurusan.length > 100) problems.push("Jurusan 2–100 karakter");
    if (!EMAIL_PATTERN.test(row.email)) problems.push("Email tidak valid");
    if (row.email && (emailCount.get(row.email.toLowerCase()) ?? 0) > 1)
      problems.push("Email ganda dalam file");
    if (row.nis && (nisCount.get(row.nis.toLowerCase()) ?? 0) > 1)
      problems.push("NIS ganda dalam file");
    return problems.join("; ");
  });
}

export interface ImportBatchDefaults {
  institutionId: string;
  participantType: "SMK_PKL" | "UNIVERSITY_INTERN" | "";
  startDate: string;
  endDate: string;
}

export interface ImportRowExtras {
  institusi: string;
  kategori: string;
  mulai: string;
  selesai: string;
}

export interface MergedImportRow {
  institutionId: string;
  participantType: "SMK_PKL" | "UNIVERSITY_INTERN";
  startDate: string;
  endDate: string;
  newInstitution?: { name: string; type: "SMK" | "UNIVERSITY" };
}

export interface InstitutionChoice {
  id: string;
  name: string;
  type: "SMK" | "UNIVERSITY";
}

/** Kolom opsional per baris (-1 bila tak ada). Header wajib ditangani mapImportHeader. */
export function mapImportExtraColumns(header: unknown[]) {
  const cells = header.map((cell) => norm(cell).toLowerCase());
  const find = (names: string[]) => cells.findIndex((cell) => names.some((n) => cell.includes(n)));
  return {
    institusi: find(["institusi", "sekolah", "kampus", "universitas", "school"]),
    kategori: find(["kategori", "tipe", "jenis", "type", "category"]),
    mulai: find(["mulai", "start", "awal"]),
    selesai: find(["selesai", "akhir", "end", "selesai"]),
  };
}

export function mapImportRowExtras(
  raw: unknown[],
  index: { institusi: number; kategori: number; mulai: number; selesai: number },
): ImportRowExtras {
  const at = (i: number) => (i >= 0 ? norm(raw[i]) : "");
  return { institusi: at(index.institusi), kategori: at(index.kategori), mulai: at(index.mulai), selesai: at(index.selesai) };
}

export function resolveImportInstitution(
  name: string,
  institutions: InstitutionChoice[],
): InstitutionChoice | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return institutions.find((item) => item.name.trim().toLowerCase() === key) ?? null;
}

export function parseImportCategory(value: string): "SMK_PKL" | "UNIVERSITY_INTERN" | null {
  const key = value.trim().toLowerCase().replace(/[\s_]+/g, " ");
  if (key === "smk pkl") return "SMK_PKL";
  if (["mahasiswa magang", "mahasiswa", "university intern", "magang"].includes(key))
    return "UNIVERSITY_INTERN";
  return null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_LABEL: Record<string, string> = { SMK_PKL: "SMK", UNIVERSITY_INTERN: "Universitas" };

function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time);
}

export function mergeRowWithBatch(
  row: ImportRowExtras,
  batch: ImportBatchDefaults,
  institutions: InstitutionChoice[],
): { value: MergedImportRow; errors: string[] } {
  const errors: string[] = [];
  const named = row.institusi
    ? resolveImportInstitution(row.institusi, institutions)
    : (institutions.find((item) => item.id === batch.institutionId) ?? null);
  // Nama tak dikenal + kategori valid = institusi BARU (dibuat saat import).
  // Tanpa kategori, tipe tak diketahui → error.
  let newInstitution: MergedImportRow["newInstitution"];
  const institution = named;
  if (row.institusi && !named) {
    const typeForNew = row.kategori
      ? parseImportCategory(row.kategori)
      : batch.participantType || null;
    if (typeForNew) {
      newInstitution = {
        name: row.institusi.trim(),
        type: typeForNew === "SMK_PKL" ? "SMK" : "UNIVERSITY",
      };
    } else {
      errors.push(
        `Institusi "${row.institusi.trim()}" belum ada — isi kolom Kategori agar bisa dibuatkan, atau perbaiki namanya.`,
      );
    }
  }
  if (!institution && !row.institusi && !newInstitution)
    errors.push("Pilih institusi di batch atau isi kolom Institusi.");

  let participantType: MergedImportRow["participantType"] | "" = "";
  if (row.kategori) {
    const parsed = parseImportCategory(row.kategori);
    if (!parsed) errors.push(`Kategori "${row.kategori}" tidak dikenal (SMK PKL / Mahasiswa Magang).`);
    else participantType = parsed;
  } else if (batch.participantType) {
    participantType = batch.participantType;
  } else {
    errors.push("Pilih kategori di batch atau isi kolom Kategori.");
  }
  if (institution && participantType) {
    const need = institution.type === "SMK" ? "SMK_PKL" : "UNIVERSITY_INTERN";
    if (participantType !== need)
      errors.push(`Kategori tidak cocok dengan tipe institusi (${CATEGORY_LABEL[need]}).`);
  }
  if (newInstitution && participantType) {
    const need = newInstitution.type === "SMK" ? "SMK_PKL" : "UNIVERSITY_INTERN";
    if (participantType !== need)
      errors.push(`Kategori tidak cocok dengan tipe institusi baru (${CATEGORY_LABEL[need]}).`);
  }

  const startDate = row.mulai || batch.startDate;
  const endDate = row.selesai || batch.endDate;
  if (!startDate || !validDate(startDate))
    errors.push("Tanggal mulai tidak valid (YYYY-MM-DD), isi sel atau batch.");
  if (!endDate || !validDate(endDate))
    errors.push("Tanggal selesai tidak valid (YYYY-MM-DD), isi sel atau batch.");
  if (validDate(startDate) && validDate(endDate) && endDate < startDate)
    errors.push("Tanggal selesai harus >= tanggal mulai.");

  return {
    value: {
      institutionId: institution?.id ?? batch.institutionId,
      participantType: (participantType || batch.participantType || "SMK_PKL") as MergedImportRow["participantType"],
      startDate,
      endDate,
      ...(newInstitution ? { newInstitution } : {}),
    },
    errors,
  };
}

export interface ImportTableRow extends ImportDraftRow {
  extras: ImportRowExtras;
}

/**
 * Petakan satu sheet (header + baris) menjadi draft + extras yang selaras.
 * Baris kosong dibuang; extras mengikuti barisnya masing-masing.
 */
export function mapImportTable(grid: unknown[][]): { rows: ImportTableRow[] } | { error: string } {
  if (!grid.length) return { error: "File kosong." };
  const mapped = mapImportHeader(grid[0] ?? []);
  if ("error" in mapped) return { error: mapped.error };
  const extraIndex = mapImportExtraColumns(grid[0] ?? []);
  const rows: ImportTableRow[] = [];
  for (const cells of grid.slice(1)) {
    const row = Array.isArray(cells) ? cells : [];
    if (!norm(row[mapped.nis]) && !norm(row[mapped.nama])) continue;
    const [draft] = mapImportRows([row], mapped);
    if (!draft) continue;
    rows.push({ ...draft, extras: mapImportRowExtras(row, extraIndex) });
    if (rows.length > MAX_IMPORT_ROWS) break;
  }
  return { rows };
}

export function photoStem(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase();
}

export function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Cocokkan foto ke baris lewat NAMA (fallback setelah NIS).
 * Nama kembar diabaikan seluruhnya — tidak menebak.
 * @returns Map NIS → filename (first match wins).
 */
export function matchPhotosByName(
  rows: Array<{ nis: string; nama: string }>,
  filenames: string[],
): Map<string, string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeName(row.nama);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const byStem = new Map<string, string>();
  for (const name of filenames) {
    const stem = normalizeName(photoStem(name));
    if (stem && !byStem.has(stem)) byStem.set(stem, name);
  }
  const out = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeName(row.nama);
    if (!key || counts.get(key) !== 1) continue;
    const hit = byStem.get(key);
    if (hit) out.set(row.nis, hit);
  }
  return out;
}

/** Map NIS → matched filename (first match wins). Pure; UI resolves URLs. */
export function matchPhotoStems(nisList: string[], filenames: string[]): Map<string, string> {
  const byStem = new Map<string, string>();
  for (const name of filenames) {
    const stem = photoStem(name);
    if (stem && !byStem.has(stem)) byStem.set(stem, name);
  }
  const out = new Map<string, string>();
  for (const nis of nisList) {
    const hit = byStem.get(nis.trim().toLowerCase());
    if (hit) out.set(nis, hit);
  }
  return out;
}

const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function pick(alphabet: string, random: (n: number) => number) {
  return alphabet[random(alphabet.length) % alphabet.length]!;
}

function shuffle<T>(items: T[], random: (n: number) => number) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = random(i + 1) % (i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** Policy-compliant password (8+, upper, lower, digit; no ambiguous chars). */
export function generateImportPassword(randomSource?: (n: number) => number) {
  const random =
    randomSource ??
    ((n: number) => {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return Number(buf[0]!) % n;
    });
  const chars = [
    pick(LOWER, random),
    pick(LOWER, random),
    pick(UPPER, random),
    pick(UPPER, random),
    pick(DIGITS, random),
    pick(DIGITS, random),
    pick(LOWER + UPPER + DIGITS, random),
    pick(LOWER + UPPER + DIGITS, random),
    pick(LOWER + UPPER + DIGITS, random),
    pick(LOWER + UPPER + DIGITS, random),
  ];
  return shuffle(chars, random).join("");
}
