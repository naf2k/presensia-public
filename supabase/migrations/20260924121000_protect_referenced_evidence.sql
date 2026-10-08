-- Fase 1 containment: participants must not delete evidence objects.
-- The previous own-prefix delete policy allowed removal of photos and
-- attachments already referenced by committed attendance/leave rows
-- (including the ambiguous network-failure cleanup path in the mobile app).
-- Orphan uploads from failed flows are now left in place; a server-side
-- reconciliation/cleanup job lands in Fase 4. No legitimate production flow
-- requires participant delete.

drop policy if exists storage_delete_own_prefix on storage.objects;
