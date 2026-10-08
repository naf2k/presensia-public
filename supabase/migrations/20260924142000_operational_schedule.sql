-- Fase 6: lock operational schedule per owner decision (2026-09-24).
-- Senin-Kamis (Jumat WFH → bukan hari kerja), masuk 07:30, toleransi 15 menit,
-- pulang 16:00, foto checkout wajib. Radius/akurasi/jurnal tidak berubah.

do $$
declare
  v_before public.attendance_settings%rowtype;
  v_admin uuid;
begin
  select * into v_before from public.attendance_settings where singleton_key;

  select id into v_admin
  from public.profiles
  where role = 'admin' and is_active
  order by created_at
  limit 1;

  update public.attendance_settings
  set work_days = array[1, 2, 3, 4],
      check_in_time = time '07:30',
      late_tolerance_minutes = 15,
      check_out_time = time '16:00',
      require_checkout_photo = true,
      updated_by = coalesce(v_admin, updated_by),
      updated_at = now()
  where singleton_key;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    v_admin,
    'SETTINGS_UPDATED',
    'attendance_settings',
    'operational-schedule',
    to_jsonb(v_before),
    (select to_jsonb(s) from public.attendance_settings s where s.singleton_key),
    'Keputusan operasional Diskominfo: Senin-Kamis, masuk 07:30 +15 mnt, pulang 16:00, foto checkout wajib.'
  );
end;
$$;
