import {
  ApiError,
  errorResponse,
  json,
  preflight,
  readObject,
  requiredString,
  requireAdmin,
} from "../_shared/http.ts";

const maxAvatarBytes = 2 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function requestString(value: unknown, maxLength: number): string {
  try {
    return requiredString(value, "request", maxLength);
  } catch {
    throw new ApiError("INVALID_REQUEST", 400);
  }
}

function decodeAvatar(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  const normalized = value.replace(/\s/g, "");
  if (normalized.length === 0 || normalized.length > Math.ceil(maxAvatarBytes / 3) * 4) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  try {
    const decoded = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
    if (decoded.length === 0 || decoded.length > maxAvatarBytes) {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("INVALID_REQUEST", 400);
  }
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { admin } = await requireAdmin(request);
    const body = await readObject(request);
    const participantId = requestString(body.participantId, 36);
    requestString(body.fileName, 255);
    const contentType = requestString(body.contentType, 50).toLowerCase();
    const extension = extensions[contentType];
    if (!uuidPattern.test(participantId) || !extension) {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    const avatar = decodeAvatar(body.base64);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("avatar_path")
      .eq("id", participantId)
      .eq("role", "participant")
      .maybeSingle();
    if (profileError) throw new ApiError("INTERNAL_ERROR", 500, "Internal server error");
    if (!profile) throw new ApiError("PARTICIPANT_NOT_FOUND", 404);

    const path = `${participantId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from("avatars").upload(path, avatar, {
      contentType,
      upsert: false,
    });
    if (uploadError) throw new ApiError("UPLOAD_FAILED", 500);

    const { data: updatedProfile, error: updateError } = await admin
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", participantId)
      .eq("role", "participant")
      .select("id")
      .maybeSingle();
    if (updateError || !updatedProfile) {
      try {
        await admin.storage.from("avatars").remove([path]);
      } catch {
        // Preserve the stable upload error even if compensating cleanup fails.
      }
      throw new ApiError("UPLOAD_FAILED", 500);
    }

    if (profile.avatar_path?.startsWith(`${participantId}/`) && profile.avatar_path !== path) {
      try {
        await admin.storage.from("avatars").remove([profile.avatar_path]);
      } catch {
        // Old-object cleanup is best-effort after the profile update succeeds.
      }
    }

    return json({ success: true, path });
  } catch (error) {
    return errorResponse(
      error instanceof ApiError
        ? error
        : new ApiError("INTERNAL_ERROR", 500, "Internal server error"),
    );
  }
});
