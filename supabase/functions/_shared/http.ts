import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AuthContext = {
  user: User;
  client: SupabaseClient;
  admin: SupabaseClient;
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function preflight(request: Request): Response | null {
  return request.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError("UNAUTHORIZED", 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) throw new ApiError("INTERNAL_ERROR", 500);

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new ApiError("UNAUTHORIZED", 401);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: data.user, client, admin };
}

export async function requireAdmin(request: Request): Promise<AuthContext> {
  const context = await requireAuth(request);
  const { data, error } = await context.client
    .from("profiles")
    .select("role,is_active")
    .eq("id", context.user.id)
    .single();
  if (error || data?.role !== "admin" || !data.is_active) {
    throw new ApiError("ADMIN_REQUIRED", 403);
  }
  return context;
}

export async function readObject(request: Request): Promise<Record<string, unknown>> {
  if (request.method !== "POST") throw new ApiError("METHOD_NOT_ALLOWED", 405);
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError("INVALID_REQUEST", 400);
  }
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code,
  ) {
    super(message);
  }
}

const conflictCodes = new Set([
  "ALREADY_CHECKED_IN",
  "ALREADY_CHECKED_OUT",
  "ATTENDANCE_ALREADY_EXISTS",
  "LEAVE_ALREADY_REVIEWED",
]);
const forbiddenCodes = new Set(["ADMIN_REQUIRED", "PARTICIPANT_REQUIRED", "ACCOUNT_INACTIVE"]);
const notFoundCodes = new Set([
  "ATTENDANCE_NOT_FOUND",
  "LEAVE_REQUEST_NOT_FOUND",
  "INTERNSHIP_INACTIVE",
]);

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json(
      { success: false, error: { code: error.code, message: error.message } },
      error.status,
    );
  }
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "INTERNAL_ERROR";
  const code = raw.match(/[A-Z][A-Z_]+/)?.[0] ?? "INTERNAL_ERROR";
  const status = conflictCodes.has(code)
    ? 409
    : forbiddenCodes.has(code)
      ? 403
      : notFoundCodes.has(code)
        ? 404
        : code === "UNAUTHORIZED"
          ? 401
          : code === "INTERNAL_ERROR"
            ? 500
            : 422;
  return json(
    {
      success: false,
      error: { code, message: code === "INTERNAL_ERROR" ? "Internal server error" : code },
    },
    status,
  );
}

export function requiredString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > maxLength) {
    throw new ApiError(`INVALID_${field.toUpperCase()}`, 422);
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string, maxLength = 500): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ApiError(`INVALID_${field.toUpperCase()}`, 422);
  }
  return value.trim();
}

export function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(`INVALID_${field.toUpperCase()}`, 422);
  }
  return value;
}
