import {
  errorResponse,
  json,
  optionalString,
  preflight,
  readObject,
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
    const photoPath = optionalString(body.photoPath, "photo_path", 500);
    const operationId = optionalUuid(body.operationId);

    if (photoPath) {
      const { data: file, error: downloadError } = await admin.storage
        .from("attendance-photos")
        .download(photoPath);
      if (downloadError || !file) throw downloadError ?? new Error("PHOTO_REQUIRED");
      await validatePhoto(new Uint8Array(await file.arrayBuffer()), MAX_PHOTO_BYTES);
    }

    const { data, error } = await client.rpc("perform_check_out", {
      p_journal_content: optionalString(body.journalContent, "journal_content", 500),
      p_photo_path: photoPath,
      p_operation_id: operationId,
    });
    if (error) throw error;
    return json({ success: true, attendance: data });
  } catch (error) {
    return errorResponse(error);
  }
});
