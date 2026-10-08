import { ApiError } from "./http.ts";

export type ValidatedPhoto = {
  size: number;
  sha256: string;
};

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length > 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

/** Verifies real image bytes (never trusts client MIME) and returns size + hash. */
export async function validatePhoto(bytes: Uint8Array, maxBytes: number): Promise<ValidatedPhoto> {
  if (bytes.length === 0) throw new ApiError("INVALID_PHOTO", 422);
  if (bytes.length > maxBytes) throw new ApiError("FILE_TOO_LARGE", 422);
  if (!isJpeg(bytes) && !isPng(bytes) && !isWebp(bytes)) {
    throw new ApiError("INVALID_PHOTO", 422);
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { size: bytes.length, sha256 };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function optionalUuid(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ApiError("INVALID_REQUEST", 422);
  }
  return value;
}
