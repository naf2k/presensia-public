-- Cleanup drill [UJI] check-in placeholder 2026-09-30 (server fix verification).
-- Menghapus seluruh jejak akun uji: absensi, operation log, audit drill,
-- internship, profil, dan akun auth. File foto yatim dibersihkan via
-- edge cleanup-orphans setelah migrasi ini.
do $$
declare
  v_pid uuid := 'e6f22848-e78f-41d0-bfbf-218661a2cc5c';
  v_att uuid := 'db939d89-54b2-406e-94a7-712bbd212213';
begin
  delete from public.attendance_records where participant_id = v_pid;
  delete from public.operation_log where user_id = v_pid;
  delete from public.audit_logs where entity_id in (v_pid::text, v_att::text);
  delete from public.internships where participant_id = v_pid;
  delete from public.profiles where id = v_pid;
  delete from auth.identities where user_id = v_pid;
  delete from auth.users where id = v_pid;
end;
$$;
