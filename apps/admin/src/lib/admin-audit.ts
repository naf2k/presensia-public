import type { AdminAudit, AuditFilter } from "./admin-api";
import { normalizeError } from "./errors";
import { formatShortTimestamp, formatTimestamp } from "./format";
import { supabase } from "./supabase";
import type { RawAudit } from "./admin-shared";
import { AUDIT_ACTION_LABELS, escapeLike } from "./admin-shared";

export async function mapAuditRows(rows: RawAudit[]): Promise<AdminAudit[]> {
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];
  const actorResult = actorIds.length
    ? await supabase.from("profiles").select("id,full_name,role").in("id", actorIds)
    : { data: [], error: null };
  if (actorResult.error) throw normalizeError(actorResult.error);
  const actors = new Map(
    ((actorResult.data ?? []) as { id: string; full_name: string; role: string }[]).map((actor) => [
      actor.id,
      actor,
    ]),
  );
  return rows.map((row) => {
    const actor = actors.get(row.actor_id ?? "");
    const before = row.before_data as Record<string, unknown> | null;
    const after = row.after_data as Record<string, unknown> | null;
    return {
      id: row.id,
      createdAt: row.created_at,
      timeLabel: formatTimestamp(row.created_at),
      shortTimeLabel: formatShortTimestamp(row.created_at),
      actor: actor?.full_name ?? "Sistem",
      actorRole: actor?.role === "admin" ? "Administrator" : "Sistem",
      actionCode: row.action,
      action: AUDIT_ACTION_LABELS[row.action] ?? "Aktivitas administratif",
      entityId: row.entity_id,
      entityKind: row.entity_type,
      reason: row.reason ?? "-",
      entityTable: row.entity_type,
      beforeData: before,
      afterData: after,
      changeBefore: before ? JSON.stringify(before) : undefined,
      changeAfter: after ? JSON.stringify(after) : undefined,
    };
  });
}

export async function auditLogs(filter: AuditFilter, page: number, perPage: number) {
  const query = filter.query.trim().toLowerCase();
  const keyword = filter.query.trim();
  const from = (page - 1) * perPage;
  const dayFrom = filter.date ? `${filter.date}T00:00:00+07:00` : null;
  const dayTo = filter.date ? `${filter.date}T23:59:59.999+07:00` : null;
  if (query) {
    // Resolve keyword matches to concrete value sets (codes/UUIDs) so the
    // main query needs no fragile .or() user-text parsing. Unknown codes
    // render as "Aktivitas administratif" — match them via action.not.in.
    const knownCodes = Object.keys(AUDIT_ACTION_LABELS);
    const codeHits = knownCodes.filter(
      (code) =>
        code.toLowerCase().includes(query) ||
        AUDIT_ACTION_LABELS[code]!.toLowerCase().includes(query),
    );
    const orTerms: string[] = [];
    if (codeHits.length) orTerms.push(`action.in.(${codeHits.join(",")})`);
    else if (/^[a-z_]+$/.test(query)) orTerms.push(`action.ilike.%${query}%`);
    if ("aktivitas administratif".includes(query))
      orTerms.push(`action.not.in.(${knownCodes.join(",")})`);
    let entityRequest = supabase
      .from("audit_logs")
      .select("id")
      .ilike("entity_id", `%${escapeLike(keyword)}%`);
    if (dayFrom && dayTo)
      entityRequest = entityRequest.gte("created_at", dayFrom).lt("created_at", dayTo);
    if (filter.action !== "all") entityRequest = entityRequest.eq("action", filter.action);
    const [profileResult, entityResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", `%${escapeLike(keyword)}%`),
      entityRequest,
    ]);
    if (profileResult.error) throw normalizeError(profileResult.error);
    if (entityResult.error) throw normalizeError(entityResult.error);
    const actorIds = ((profileResult.data ?? []) as { id: string }[]).map((row) => row.id);
    const entityIds = ((entityResult.data ?? []) as { id: string }[]).map((row) => row.id);
    if (actorIds.length) orTerms.push(`actor_id.in.(${actorIds.join(",")})`);
    if (entityIds.length) orTerms.push(`id.in.(${entityIds.join(",")})`);
    if (!orTerms.length) return { rows: [], total: 0 };
    let scoped = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (dayFrom && dayTo) scoped = scoped.gte("created_at", dayFrom).lt("created_at", dayTo);
    if (filter.action !== "all") scoped = scoped.eq("action", filter.action);
    const { data, error, count } = await scoped
      .or(orTerms.join(","))
      .range(from, from + perPage - 1);
    if (error) throw normalizeError(error);
    return { rows: await mapAuditRows((data ?? []) as RawAudit[]), total: count ?? 0 };
  }
  let scoped = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (dayFrom && dayTo) scoped = scoped.gte("created_at", dayFrom).lt("created_at", dayTo);
  if (filter.action !== "all") scoped = scoped.eq("action", filter.action);
  const { data, error, count } = await scoped.range(from, from + perPage - 1);
  if (error) throw normalizeError(error);
  return { rows: await mapAuditRows((data ?? []) as RawAudit[]), total: count ?? 0 };
}
