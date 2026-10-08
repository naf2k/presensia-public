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

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { client } = await requireAdmin(request);
    const body = await readObject(request);
    const decision = requiredString(body.decision, "decision", 10);
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      throw new ApiError("INVALID_LEAVE_DECISION", 422);
    }
    const { data, error } = await client.rpc("admin_review_leave", {
      p_leave_request_id: requiredString(body.leaveRequestId, "leave_request_id", 36),
      p_decision: decision,
      p_admin_note: optionalString(body.adminNote, "admin_note", 500),
      p_operation_id: optionalUuid(body.operationId),
    });
    if (error) throw error;
    return json({ success: true, leaveRequest: data });
  } catch (error) {
    return errorResponse(error);
  }
});
