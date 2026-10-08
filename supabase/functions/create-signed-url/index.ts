import {
  ApiError,
  errorResponse,
  json,
  preflight,
  readObject,
  requiredString,
  requireAuth,
} from "../_shared/http.ts";

const allowedBuckets = new Set(["attendance-photos", "leave-attachments", "avatars"]);

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { user, client, admin } = await requireAuth(request);
    const body = await readObject(request);
    const bucket = requiredString(body.bucket, "bucket", 50);
    const path = requiredString(body.path, "path", 500);
    if (!allowedBuckets.has(bucket)) throw new ApiError("INVALID_BUCKET", 422);
    if (path.includes("..") || path.startsWith("/") || path.includes("\\")) {
      throw new ApiError("INVALID_REQUEST", 400);
    }

    const { data: profile } = await client
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .single();
    const ownerId = path.split("/")[0];
    if (!profile?.is_active || (profile.role !== "admin" && ownerId !== user.id)) {
      throw new ApiError("FORBIDDEN", 403);
    }

    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 300);
    if (error) throw new ApiError("OBJECT_NOT_FOUND", 404);
    return json({ success: true, signedUrl: data.signedUrl, expiresIn: 300 });
  } catch (error) {
    return errorResponse(error);
  }
});
