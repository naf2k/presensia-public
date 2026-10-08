import {
  ApiError,
  errorResponse,
  json,
  optionalString,
  preflight,
  readObject,
  requiredString,
  requireAdmin,
} from "../_shared/http.ts";

const participantTypes = new Set(["SMK_PKL", "UNIVERSITY_INTERN"]);
const MAX_ROWS = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function randomInt(n: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Number(buf[0]) % n;
}

function pick(alphabet: string) {
  return alphabet[randomInt(alphabet.length)];
}

// Same policy as the admin UI (8+, upper, lower, digit; no ambiguous chars).
function generatePassword() {
  const chars = [
    pick(LOWER),
    pick(LOWER),
    pick(UPPER),
    pick(UPPER),
    pick(DIGITS),
    pick(DIGITS),
    pick(LOWER + UPPER + DIGITS),
    pick(LOWER + UPPER + DIGITS),
    pick(LOWER + UPPER + DIGITS),
    pick(LOWER + UPPER + DIGITS),
  ];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

type ImportRow = {
  studentNumber?: unknown;
  fullName?: unknown;
  major?: unknown;
  email?: unknown;
  phone?: unknown;
  institutionId?: unknown;
  participantType?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  newInstitution?: unknown;
};

type NewInstitution = { name: string; type: "SMK" | "UNIVERSITY" };

function asNewInstitution(value: unknown): NewInstitution | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { name?: unknown; type?: unknown };
  const name = String(record.name ?? "").trim();
  const type = String(record.type ?? "").trim();
  if (name.length < 2 || name.length > 150) return null;
  if (type !== "SMK" && type !== "UNIVERSITY") return null;
  return { name, type };
}

type NormalizedRow = {
  studentNumber: string;
  fullName: string;
  major: string;
  email: string;
  phone: string;
  institutionId: string | null;
  participantType: "SMK_PKL" | "UNIVERSITY_INTERN" | null;
  startDate: string | null;
  endDate: string | null;
  badStart: boolean;
  badEnd: boolean;
  badInstitution: boolean;
  badType: boolean;
  newInstitution: NewInstitution | null;
};

function isRateLimited(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { status?: unknown; message?: unknown; code?: unknown };
  if (record.status === 429) return true;
  const text = `${String(record.message ?? "")} ${String(record.code ?? "")}`.toLowerCase();
  return text.includes("rate limit") || text.includes("too many requests");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function asDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const time = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(time) ? text : null;
}

function asInstitutionId(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(text) ? text : null;
}

function asParticipantType(value: unknown): "SMK_PKL" | "UNIVERSITY_INTERN" | null {
  const text = String(value ?? "").trim();
  return participantTypes.has(text) ? (text as "SMK_PKL" | "UNIVERSITY_INTERN") : null;
}

function rowError(row: ImportRow): string | null {
  const studentNumber = String(row.studentNumber ?? "").trim();
  const fullName = String(row.fullName ?? "").trim();
  const major = String(row.major ?? "").trim();
  const email = String(row.email ?? "").trim().toLowerCase();
  if (studentNumber.length < 2 || studentNumber.length > 50) return "INVALID_STUDENT_NUMBER";
  if (fullName.length < 2 || fullName.length > 100) return "INVALID_FULL_NAME";
  if (major.length < 2 || major.length > 100) return "INVALID_MAJOR";
  if (!EMAIL_PATTERN.test(email)) return "INVALID_EMAIL";
  return null;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { user: actor, admin } = await requireAdmin(request);
    const body = await readObject(request);
    // Batch defaults: every field optional. Rows carry overrides; effective
    // values are resolved + validated per row below (never trust the client).
    const defaultInstitution = asInstitutionId(body.institutionId);
    const defaultType = body.participantType === undefined || body.participantType === ""
      ? null
      : asParticipantType(body.participantType);
    if (body.participantType !== undefined && body.participantType !== "" && !defaultType)
      throw new ApiError("INVALID_PARTICIPANT_TYPE", 422);
    const defaultStart = body.startDate === undefined || body.startDate === "" ? null : asDate(body.startDate);
    const defaultEnd = body.endDate === undefined || body.endDate === "" ? null : asDate(body.endDate);
    if ((body.startDate || body.endDate) && (!defaultStart || !defaultEnd || defaultEnd < defaultStart))
      throw new ApiError("INVALID_DATES", 422);
    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ROWS) {
      throw new ApiError("INVALID_ROW_COUNT", 422);
    }

    const seenEmails = new Set<string>();
    const has = (v: unknown) => String(v ?? "").trim() !== "";
    const normalized: NormalizedRow[] = (rows as ImportRow[]).map((raw) => {
      // newInstitution menang atas institutionId bila keduanya ada:
      // badge preview "BARU" berarti niatnya membuat, bukan memakai id batch.
      const explicitNew = asNewInstitution(raw.newInstitution);
      return {
        studentNumber: String(raw.studentNumber ?? "").trim(),
        fullName: String(raw.fullName ?? "").trim(),
        major: String(raw.major ?? "").trim(),
        email: String(raw.email ?? "").trim().toLowerCase(),
        phone: String(raw.phone ?? "").trim(),
        institutionId: explicitNew ? null : (asInstitutionId(raw.institutionId) ?? defaultInstitution),
        participantType: asParticipantType(raw.participantType) ?? defaultType,
        startDate: asDate(raw.startDate) ?? defaultStart,
        endDate: asDate(raw.endDate) ?? defaultEnd,
        badStart: has(raw.startDate) && !asDate(raw.startDate),
        badEnd: has(raw.endDate) && !asDate(raw.endDate),
        badInstitution: has(raw.institutionId) && !asInstitutionId(raw.institutionId),
        badType: has(raw.participantType) && !asParticipantType(raw.participantType),
        newInstitution: explicitNew,
      };
    });

    const rowScopeError = (row: NormalizedRow): string | null => {
      if (!row.institutionId && !row.newInstitution) return "INVALID_INSTITUTION";
      if (row.badInstitution) return "INVALID_INSTITUTION";
      if (!row.participantType || row.badType) return "INVALID_PARTICIPANT_TYPE";
      if (!row.startDate || !row.endDate || row.badStart || row.badEnd) return "INVALID_DATES";
      if (row.endDate < row.startDate) return "INVALID_DATES";
      return null;
    };

    // Buat institusi yang belum ada (dedup per nama+tipe; balapan insert
    // ditangani via konflik unik → pakai yang sudah ada).
    const wantedNew = new Map<string, NewInstitution>();
    for (const row of normalized) {
      if (!row.newInstitution) continue;
      const key = `${row.newInstitution.name.toLowerCase()}::${row.newInstitution.type}`;
      if (!wantedNew.has(key)) wantedNew.set(key, row.newInstitution);
    }
    const createdInstitutions = new Map<string, string>();
    for (const item of wantedNew.values()) {
      const inserted = await admin
        .from("institutions")
        .insert({ name: item.name, institution_type: item.type, is_active: true })
        .select("id,institution_type");
      if (!inserted.error && inserted.data && inserted.data.length) {
        createdInstitutions.set(
          `${item.name.toLowerCase()}::${item.type}`,
          (inserted.data[0] as { id: string }).id,
        );
        continue;
      }
      // Kemungkinan sudah ada (balapan / dibuat manual bersamaan): resolve ulang.
      const existing = await admin
        .from("institutions")
        .select("id,institution_type")
        .ilike("name", item.name);
      const exact = ((existing.data ?? []) as { id: string; institution_type: string }[]).find(
        (row) => row.institution_type === item.type,
      );
      if (exact) {
        createdInstitutions.set(`${item.name.toLowerCase()}::${item.type}`, exact.id);
      } else {
        throw new ApiError("INVALID_INSTITUTION", 422);
      }
    }
    for (const row of normalized) {
      if (!row.newInstitution || row.institutionId) continue;
      const hit = createdInstitutions.get(
        `${row.newInstitution.name.toLowerCase()}::${row.newInstitution.type}`,
      );
      if (hit) row.institutionId = hit;
    }

    // Institution directory for type cross-checks (single query).
    const wantedInstitutions = [...new Set(normalized.map((r) => r.institutionId).filter(Boolean))] as string[];
    const directory = new Map<string, "SMK" | "UNIVERSITY">();
    if (wantedInstitutions.length) {
      const { data } = await admin
        .from("institutions")
        .select("id,institution_type")
        .in("id", wantedInstitutions);
      for (const row of (data ?? []) as { id: string; institution_type: "SMK" | "UNIVERSITY" }[])
        directory.set(row.id, row.institution_type);
    }

    // Pre-check against the database so taken emails/NIS fail fast with a
    // clear code instead of a constraint error mid-batch. NIS uniqueness is
    // per institution, so numbers resolve within their row's institution.
    const takenEmails = new Set<string>();
    const takenNumbers = new Set<string>();
    const emailList = [...new Set(normalized.map((r) => r.email).filter(Boolean))];
    if (emailList.length) {
      const { data } = await admin.from("profiles").select("email").in("email", emailList);
      for (const row of (data ?? []) as { email: string }[]) takenEmails.add(row.email.toLowerCase());
    }
    const numbersByInstitution = new Map<string, string[]>();
    for (const row of normalized) {
      if (!row.institutionId || !row.studentNumber) continue;
      const list = numbersByInstitution.get(row.institutionId) ?? [];
      list.push(row.studentNumber);
      numbersByInstitution.set(row.institutionId, list);
    }
    for (const [institutionId, numbers] of numbersByInstitution) {
      const { data } = await admin
        .from("internships")
        .select("institution_id,student_number")
        .eq("institution_id", institutionId)
        .in("student_number", [...new Set(numbers)]);
      // Compare case-insensitively (unique index is on lower()).
      for (const row of (data ?? []) as { institution_id: string; student_number: string }[])
        takenNumbers.add(`${row.institution_id}::${row.student_number.toLowerCase()}`);
    }

    // Map pre-existing auth users (no profile yet) so throttled earlier
    // attempts can resume instead of colliding on re-invite.
    const orphanIds = new Map<string, string>();
    try {
      const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of userList?.users ?? []) {
        if (u.email) orphanIds.set(u.email.toLowerCase(), u.id);
      }
    } catch {
      // Non-fatal: per-row handling below still guards duplicates.
    }

    const succeeded: Array<{ email: string; password: string; participantId: string }> = [];
    const failed: Array<{ email: string; code: string }> = [];

    for (const raw of normalized) {
      const email = raw.email;
      const invalid = rowError(raw) ?? rowScopeError(raw);
      if (invalid || seenEmails.has(email)) {
        failed.push({ email: email || "(tanpa email)", code: invalid ?? "DUPLICATE_EMAIL_IN_FILE" });
        continue;
      }
      if (takenEmails.has(email)) {
        failed.push({ email, code: "EMAIL_ALREADY_REGISTERED" });
        continue;
      }
      const instType = directory.get(raw.institutionId!);
      if (!instType) {
        failed.push({ email, code: "INVALID_INSTITUTION" });
        continue;
      }
      if ((instType === "SMK") !== (raw.participantType === "SMK_PKL")) {
        failed.push({ email, code: "INVALID_PARTICIPANT_TYPE" });
        continue;
      }
      if (takenNumbers.has(`${raw.institutionId}::${raw.studentNumber.toLowerCase()}`)) {
        failed.push({ email, code: "STUDENT_NUMBER_TAKEN" });
        continue;
      }
      seenEmails.add(email);
      const password = generatePassword();
      try {
        let userId = orphanIds.get(email);
        let fresh = false;
        let createdId: string | null = null;
        if (!userId) {
          // createUser is rate-limited by Auth: retry a few times with backoff
          // before giving up on the row (other rows still proceed).
          let invited: { user: { id: string; created_at?: string } | null } | null = null;
          let inviteError: unknown = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const created = await admin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name: String(raw.fullName).trim() },
            });
            invited = created.data as typeof invited;
            inviteError = created.error;
            if (!inviteError || !isRateLimited(inviteError)) break;
            await sleep(2000 * (attempt + 1));
          }
          if (inviteError || !invited?.user) throw inviteError ?? new ApiError("AUTH_USER_CREATION_FAILED", 500);
          const createdAt = Date.parse(invited.user.created_at ?? "");
          fresh = Number.isFinite(createdAt) && Date.now() - createdAt < 120_000;
          userId = invited.user.id;
          if (fresh) createdId = userId;
        }
        const { data, error } = await admin.rpc("provision_participant", {
          p_actor_id: actor.id,
          p_user_id: userId,
          p_email: email,
          p_full_name: String(raw.fullName).trim(),
          p_phone: optionalString(raw.phone, "phone", 30),
          p_institution_id: raw.institutionId,
          p_participant_type: raw.participantType,
          p_student_number: String(raw.studentNumber).trim(),
          p_major: String(raw.major).trim(),
          p_start_date: raw.startDate,
          p_end_date: raw.endDate,
          p_is_active: true,
        });
        if (error) {
          if (createdId) await admin.auth.admin.deleteUser(createdId);
          throw error;
        }
        const participantId = (data as { profile?: { id?: string } } | null)?.profile?.id;
        if (!participantId) {
          if (createdId) await admin.auth.admin.deleteUser(createdId);
          throw new ApiError("BACKEND_FAILURE", 500);
        }
        succeeded.push({ email, password, participantId });
      } catch (error) {
        let code: string;
        if (error instanceof ApiError) code = error.code;
        else if (isRateLimited(error)) code = "RATE_LIMITED";
        else if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          String((error as { message: unknown }).message)
            .toLowerCase()
            .includes("already been registered")
        )
          code = "EMAIL_ALREADY_REGISTERED";
        else if (error && typeof error === "object" && "code" in error)
          code = String((error as { code: unknown }).code);
        else code = "CREATE_FAILED";
        failed.push({ email, code });
      }
    }

    return json({ success: true, succeeded, failed }, 200);
  } catch (error) {
    return errorResponse(error);
  }
});
