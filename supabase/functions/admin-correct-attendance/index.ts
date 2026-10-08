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
import { optionalUuid } from "../_shared/evidence.ts";

const statuses = new Set(["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "TIDAK_HADIR"]);

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { client } = await requireAdmin(request);
    const body = await readObject(request);
    const status = optionalString(body.status, "status", 20);
    if (status && !statuses.has(status)) throw new ApiError("INVALID_STATUS", 422);
    const reason = requiredString(body.reason, "reason", 1000);
    if (reason.length < 5) throw new ApiError("CORRECTION_REASON_REQUIRED", 422);
    const { data, error } = await client.rpc("admin_correct_attendance", {
      p_attendance_id: requiredString(body.attendanceId, "attendance_id", 36),
      p_reason: reason,
      p_status: status,
      p_check_in_at: optionalString(body.checkInAt, "check_in_at", 40),
      p_check_out_at: optionalString(body.checkOutAt, "check_out_at", 40),
      p_operation_id: optionalUuid(body.operationId),
    });
    if (error) throw error;
    return json({ success: true, attendance: data });
  } catch (error) {
    return errorResponse(error);
  }
});
