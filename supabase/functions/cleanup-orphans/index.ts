import { errorResponse, json, preflight, requireAdmin } from "../_shared/http.ts";

const BUCKETS = ["attendance-photos", "leave-attachments", "avatars"] as const;
const GRACE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>["admin"];

async function walk(
  admin: AdminClient,
  bucket: string,
  prefix: string,
  files: { path: string; createdAt: string }[],
): Promise<void> {
  let page = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error || !data || data.length === 0) return;
    for (const entry of data) {
      if (!entry.name) continue;
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!entry.created_at) {
        // Folder placeholder: recurse.
        await walk(admin, bucket, fullPath, files);
        continue;
      }
      files.push({ path: fullPath, createdAt: entry.created_at });
    }
    if (data.length < PAGE_SIZE) return;
    page += 1;
  }
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    const { admin } = await requireAdmin(request);
    const cutoff = new Date(Date.now() - GRACE_MS).toISOString();

    const { data: attendance } = await admin
      .from("attendance_records")
      .select("check_in_photo_path,check_out_photo_path");
    const { data: leaves } = await admin.from("leave_requests").select("attachment_path");
    const { data: profiles } = await admin.from("profiles").select("avatar_path");
    const referenced = new Set(
      [
        ...(attendance ?? []).flatMap((row) => [row.check_in_photo_path, row.check_out_photo_path]),
        ...(leaves ?? []).map((row) => row.attachment_path),
        ...(profiles ?? []).map((row) => row.avatar_path),
      ].filter((path): path is string => typeof path === "string" && path.length > 0),
    );

    const deleted: string[] = [];
    let scanned = 0;
    for (const bucket of BUCKETS) {
      const files: { path: string; createdAt: string }[] = [];
      await walk(admin, bucket, "", files);
      for (const file of files) {
        scanned += 1;
        if (file.createdAt > cutoff) continue;
        if (referenced.has(file.path)) continue;
        const { error: removeError } = await admin.storage.from(bucket).remove([file.path]);
        if (!removeError) deleted.push(`${bucket}/${file.path}`);
      }
    }
    return json({ success: true, scanned, deleted });
  } catch (error) {
    return errorResponse(error);
  }
});
