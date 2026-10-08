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
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function randomInt(n: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Number(buf[0]) % n;
}

function generatePassword() {
  const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];
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

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { user: actor, admin } = await requireAdmin(request);
    const body = await readObject(request);
    const email = requiredString(body.email, "email", 320).toLowerCase();
    const participantType = requiredString(body.participantType, "participant_type", 30);
    if (!participantTypes.has(participantType)) throw new ApiError("INVALID_PARTICIPANT_TYPE", 422);
    if (typeof body.isActive !== "boolean") throw new ApiError("INVALID_IS_ACTIVE", 422);

    // Duplicate guard FIRST (before invite): an existing profile means this
    // email is already onboarded. inviteUserByEmail on a taken address can
    // throw, and must never trigger a new invitation mail for duplicates.
    const { data: existing, error: lookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) throw new ApiError("EMAIL_ALREADY_REGISTERED", 409);

    // Direct password (no email invite): provided or auto-generated.
    const rawPassword = typeof body.password === "string" ? body.password : "";
    const password = rawPassword || generatePassword();
    if (!PASSWORD_PATTERN.test(password)) throw new ApiError("INVALID_PASSWORD", 422);

    const { data: invited, error: inviteError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: requiredString(body.fullName, "full_name", 100) },
    });
    if (inviteError || !invited.user)
      throw inviteError ?? new ApiError("AUTH_USER_CREATION_FAILED", 500);

    const createdAt = Date.parse(invited.user.created_at ?? "");
    const freshAuthUser = Number.isFinite(createdAt) && Date.now() - createdAt < 120_000;

    const { data, error } = await admin.rpc("provision_participant", {
      p_actor_id: actor.id,
      p_user_id: invited.user.id,
      p_email: email,
      p_full_name: requiredString(body.fullName, "full_name", 100),
      p_phone: optionalString(body.phone, "phone", 30),
      p_institution_id: requiredString(body.institutionId, "institution_id", 36),
      p_participant_type: participantType,
      p_student_number: requiredString(body.studentNumber, "student_number", 50),
      p_major: requiredString(body.major, "major", 100),
      p_start_date: requiredString(body.startDate, "start_date", 10),
      p_end_date: requiredString(body.endDate, "end_date", 10),
      p_is_active: body.isActive,
    });
    if (error) {
      // Roll back ONLY an auth user created by this call — never delete a
      // pre-existing account that merely collided on email.
      if (freshAuthUser) await admin.auth.admin.deleteUser(invited.user.id);
      throw error;
    }
    const participantId = (data as { profile?: { id?: string } } | null)?.profile?.id;
    if (!participantId) {
      if (freshAuthUser) await admin.auth.admin.deleteUser(invited.user.id);
      throw new ApiError("BACKEND_FAILURE", 500);
    }
    return json({ success: true, participant: data, password, generated: !rawPassword }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
