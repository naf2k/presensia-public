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

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { client, admin } = await requireAdmin(request);
    const body = await readObject(request);
    const participantId = requiredString(body.participantId, "participant_id", 36);
    const email = requiredString(body.email, "email", 320).toLowerCase();
    const participantType = requiredString(body.participantType, "participant_type", 30);
    if (!participantTypes.has(participantType)) throw new ApiError("INVALID_PARTICIPANT_TYPE", 422);
    if (typeof body.isActive !== "boolean") throw new ApiError("INVALID_IS_ACTIVE", 422);

    const { data: currentUser, error: userError } =
      await admin.auth.admin.getUserById(participantId);
    if (userError || !currentUser.user) throw new ApiError("PARTICIPANT_NOT_FOUND", 404);
    const oldEmail = currentUser.user.email;
    if (oldEmail !== email) {
      const { error } = await admin.auth.admin.updateUserById(participantId, {
        email,
        email_confirm: true,
      });
      if (error) throw error;
    }

    const { data, error } = await client.rpc("admin_update_participant", {
      p_participant_id: participantId,
      p_email: email,
      p_full_name: requiredString(body.fullName, "full_name", 100),
      p_phone: optionalString(body.phone, "phone", 30),
      p_is_active: body.isActive,
      p_institution_id: requiredString(body.institutionId, "institution_id", 36),
      p_participant_type: participantType,
      p_student_number: requiredString(body.studentNumber, "student_number", 50),
      p_major: requiredString(body.major, "major", 100),
      p_start_date: requiredString(body.startDate, "start_date", 10),
      p_end_date: requiredString(body.endDate, "end_date", 10),
      p_reason: optionalString(body.reason, "reason", 1000),
    });
    if (error) {
      if (oldEmail && oldEmail !== email) {
        await admin.auth.admin.updateUserById(participantId, {
          email: oldEmail,
          email_confirm: true,
        });
      }
      throw error;
    }
    return json({ success: true, participant: data });
  } catch (error) {
    return errorResponse(error);
  }
});
