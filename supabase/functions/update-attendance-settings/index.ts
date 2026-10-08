import {
  ApiError,
  errorResponse,
  json,
  preflight,
  readObject,
  requiredNumber,
  requiredString,
  requireAdmin,
} from "../_shared/http.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { client } = await requireAdmin(request);
    const body = await readObject(request);
    if (!Array.isArray(body.workDays) || body.workDays.some((day) => !Number.isInteger(day))) {
      throw new ApiError("INVALID_WORK_DAYS", 422);
    }
    if (typeof body.requireCheckoutPhoto !== "boolean") {
      throw new ApiError("INVALID_REQUIRE_CHECKOUT_PHOTO", 422);
    }
    const { data, error } = await client.rpc("admin_update_attendance_settings", {
      p_work_days: body.workDays,
      p_check_in_time: requiredString(body.checkInTime, "check_in_time", 8),
      p_late_tolerance_minutes: requiredNumber(body.lateToleranceMinutes, "late_tolerance_minutes"),
      p_check_out_time: requiredString(body.checkOutTime, "check_out_time", 8),
      p_location_name: requiredString(body.locationName, "location_name", 150),
      p_latitude: requiredNumber(body.latitude, "latitude"),
      p_longitude: requiredNumber(body.longitude, "longitude"),
      p_radius_meters: requiredNumber(body.radiusMeters, "radius_meters"),
      p_max_location_accuracy_meters: requiredNumber(
        body.maxLocationAccuracyMeters,
        "max_location_accuracy_meters",
      ),
      p_require_checkout_photo: body.requireCheckoutPhoto,
      p_max_journal_length: requiredNumber(body.maxJournalLength, "max_journal_length"),
    });
    if (error) throw error;
    return json({ success: true, settings: data });
  } catch (error) {
    return errorResponse(error);
  }
});
