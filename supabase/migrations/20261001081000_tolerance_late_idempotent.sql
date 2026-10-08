-- Lanjutan 20261001080000: overload idempoten (+p_operation_id) yang dipakai
-- edge function admin juga harus memakai rumus toleransi. Disalin verbatim
-- dari 20260924135000 + satu baris rumus tiap fungsi. Signature & grant
-- tidak berubah.

create or replace function public.admin_correct_attendance(
  p_attendance_id uuid,
  p_reason text,
  p_status public.attendance_status default null,
  p_check_in_at timestamptz default null,
  p_check_out_at timestamptz default null,
  p_operation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.attendance_records%rowtype;
  v_after public.attendance_records%rowtype;
  v_settings public.attendance_settings%rowtype;
  v_status public.attendance_status;
  v_final_check_in timestamptz;
  v_late integer;
  v_replay jsonb;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = 'P0001', message = 'CORRECTION_REASON_REQUIRED';
  end if;

  v_replay := public.claim_operation(p_operation_id, 'ATTENDANCE_CORRECT');
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_before from public.attendance_records
  where id = p_attendance_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_NOT_FOUND';
  end if;
  v_status := coalesce(p_status, v_before.status);

  select * into v_settings from public.attendance_settings where singleton_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;

  v_final_check_in := case
    when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null
    else coalesce(p_check_in_at, v_before.check_in_at)
  end;
  -- Toleransi = tidak terlambat (sama seperti 20261001080000).
  v_late := case
    when v_final_check_in is null then 0
    else greatest(
      0,
      floor(extract(epoch from (
        (v_final_check_in at time zone v_settings.timezone)::time - v_settings.check_in_time
          - make_interval(mins => v_settings.late_tolerance_minutes)
      )) / 60)::integer
    )
  end;

  update public.attendance_records set
    status = v_status,
    source = 'ADMIN_CORRECTION',
    leave_request_id = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else leave_request_id end,
    check_in_at = v_final_check_in,
    check_in_photo_path = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_photo_path end,
    check_in_latitude = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_latitude end,
    check_in_longitude = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_longitude end,
    check_in_accuracy_m = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_accuracy_m end,
    check_in_distance_m = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_distance_m end,
    late_minutes = v_late,
    early_checkout_minutes = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then 0 else early_checkout_minutes end,
    work_duration_minutes = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else work_duration_minutes end,
    check_out_at = case
      when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null
      else coalesce(p_check_out_at, check_out_at)
    end,
    check_out_photo_path = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_out_photo_path end,
    corrected_at = now(),
    corrected_by = auth.uid()
  where id = p_attendance_id
  returning * into v_after;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, reason
  ) values (
    auth.uid(), 'ATTENDANCE_CORRECTED', 'attendance_record', p_attendance_id::text,
    to_jsonb(v_before), to_jsonb(v_after), trim(p_reason)
  );

  v_result := to_jsonb(v_after);
  perform public.complete_operation(p_operation_id, v_result);
  return v_result;
end;
$$;

create or replace function public.admin_create_attendance(
  p_participant_id uuid,
  p_date date,
  p_status public.attendance_status,
  p_reason text,
  p_check_in_at timestamptz default null,
  p_check_out_at timestamptz default null,
  p_photo_path text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters double precision default null,
  p_operation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.profiles%rowtype;
  v_internship public.internships%rowtype;
  v_settings public.attendance_settings%rowtype;
  v_local_check_in time;
  v_distance double precision;
  v_late integer := 0;
  v_status public.attendance_status := p_status;
  v_replay jsonb;
  v_result jsonb;
  v_record public.attendance_records%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = 'P0001', message = 'CORRECTION_REASON_REQUIRED';
  end if;
  if p_date is null or p_status is null then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;

  v_replay := public.claim_operation(p_operation_id, 'ATTENDANCE_CREATE');
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_user from public.profiles where id = p_participant_id;
  if not found or v_user.role <> 'participant' then
    raise exception using errcode = 'P0001', message = 'PARTICIPANT_REQUIRED';
  end if;
  if not v_user.is_active then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_INACTIVE';
  end if;

  select * into v_settings from public.attendance_settings where singleton_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;

  select * into v_internship
  from public.internships
  where participant_id = p_participant_id
    and is_active
    and p_date between start_date and end_date;
  if not found then
    raise exception using errcode = 'P0001', message = 'INTERNSHIP_INACTIVE';
  end if;

  if extract(isodow from p_date)::smallint <> all(v_settings.work_days) then
    raise exception using errcode = 'P0001', message = 'NOT_WORK_DAY';
  end if;
  if exists (select 1 from public.holiday_calendar where holiday_date = p_date) then
    raise exception using errcode = 'P0001', message = 'NOT_WORK_DAY';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_participant_id::text || ':' || p_date::text, 0)
  );
  if exists (
    select 1 from public.attendance_records
    where participant_id = p_participant_id and attendance_date = p_date
  ) then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_ALREADY_EXISTS';
  end if;

  if v_status in ('HADIR', 'TERLAMBAT') then
    if p_check_in_at is null
      or (p_check_in_at at time zone v_settings.timezone)::date <> p_date then
      raise exception using errcode = 'P0001', message = 'INVALID_CHECK_IN_TIME';
    end if;
    if p_photo_path is null or trim(p_photo_path) = ''
      or p_latitude is null or p_latitude not between -90 and 90
      or p_longitude is null or p_longitude not between -180 and 180
      or p_accuracy_meters is null or p_accuracy_meters < 0
      or p_accuracy_meters > v_settings.max_location_accuracy_meters then
      raise exception using errcode = 'P0001', message = 'EVIDENCE_REQUIRED';
    end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'attendance-photos'
        and o.name = p_photo_path
    ) then
      raise exception using errcode = 'P0001', message = 'PHOTO_REQUIRED';
    end if;
    v_distance := public.haversine_distance_meters(
      p_latitude, p_longitude,
      v_settings.latitude::double precision,
      v_settings.longitude::double precision
    );
    if v_distance > v_settings.radius_meters then
      raise exception using errcode = 'P0001', message = 'LOCATION_OUTSIDE_RADIUS';
    end if;
    v_local_check_in := (p_check_in_at at time zone v_settings.timezone)::time;
    -- Toleransi = tidak terlambat (sama seperti 20261001080000).
    v_late := greatest(
      0,
      floor(extract(epoch from (
        v_local_check_in - v_settings.check_in_time
          - make_interval(mins => v_settings.late_tolerance_minutes)
      )) / 60)::integer
    );
    if v_status = 'HADIR'
      and v_local_check_in > v_settings.check_in_time
        + make_interval(mins => v_settings.late_tolerance_minutes) then
      v_status := 'TERLAMBAT';
    end if;
  end if;

  insert into public.attendance_records (
    participant_id, internship_id, attendance_date, status, source,
    check_in_at, check_in_photo_path, check_in_latitude, check_in_longitude,
    check_in_accuracy_m, check_in_distance_m, late_minutes,
    check_out_at, corrected_by, corrected_at, policy_snapshot
  ) values (
    p_participant_id, v_internship.id, p_date, v_status, 'ADMIN_CORRECTION',
    case when v_status in ('HADIR', 'TERLAMBAT') then p_check_in_at end,
    case when v_status in ('HADIR', 'TERLAMBAT') then nullif(trim(p_photo_path), '') end,
    case when v_status in ('HADIR', 'TERLAMBAT') then p_latitude end,
    case when v_status in ('HADIR', 'TERLAMBAT') then p_longitude end,
    case when v_status in ('HADIR', 'TERLAMBAT') then p_accuracy_meters end,
    case when v_status in ('HADIR', 'TERLAMBAT') then v_distance end,
    v_late,
    case when v_status in ('HADIR', 'TERLAMBAT') then p_check_out_at end,
    auth.uid(), now(),
    public.policy_snapshot_for(v_settings)
  ) returning * into v_record;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, after_data, reason
  ) values (
    auth.uid(), 'ATTENDANCE_CREATED', 'attendance_record', v_record.id::text,
    to_jsonb(v_record), trim(p_reason)
  );

  v_result := to_jsonb(v_record);
  perform public.complete_operation(p_operation_id, v_result);
  return v_result;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_ALREADY_EXISTS';
end;
$$;
