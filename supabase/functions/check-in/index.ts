import {
  errorResponse,
  json,
  preflight,
  readObject,
  requiredNumber,
  requiredString,
  requireAuth,
} from "../_shared/http.ts";
import { optionalUuid, validatePhoto } from "../_shared/evidence.ts";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { admin, client } = await requireAuth(request);
    const body = await readObject(request);
    const photoPath = requiredString(body.photoPath, "photo_path", 500);
    const operationId = optionalUuid(body.operationId);

    const { data: file, error: downloadError } = await admin.storage
      .from("attendance-photos")
      .download(photoPath);
    if (downloadError || !file) throw downloadError ?? new Error("PHOTO_REQUIRED");
    const photo = await validatePhoto(new Uint8Array(await file.arrayBuffer()), MAX_PHOTO_BYTES);

    const { data, error } = await client.rpc("perform_check_in", {
      p_photo_path: photoPath,
      p_latitude: requiredNumber(body.latitude, "latitude"),
      p_longitude: requiredNumber(body.longitude, "longitude"),
      p_accuracy_meters: requiredNumber(body.accuracyMeters, "accuracy_meters"),
      p_operation_id: operationId,
      p_photo_hash: photo.sha256,
      p_photo_size: photo.size,
    });
    if (error) throw error;
    return json({ success: true, attendance: data });
  } catch (error) {
    return errorResponse(error);
  }
});
