-- Insiden 2026-09-30: baris placeholder (tanpa check-in, mis. TIDAK_HADIR dari
-- materialisasi/koreksi admin) memblokir check-in peserta — guard lama menolak
-- SEMBARANG baris hari ini sebagai ALREADY_CHECKED_IN.
-- Perilaku baru perform_check_in:
-- - baris ada + check_in_at terisi      -> ALREADY_CHECKED_IN (tetap ditolak)
-- - baris ada + status IZIN/SAKIT       -> ON_APPROVED_LEAVE (tidak perlu absen)
-- - baris ada + TANPA check-in          -> DIUBAH jadi check-in asli (UPDATE)
-- - tidak ada baris                     -> INSERT seperti semula
-- Signature tidak berubah sehingga grant existing tetap berlaku.

create or replace function public.perform_check_in(
  p_photo_path text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_operation_id uuid default null,
  p_photo_hash text default null,
  p_photo_size integer default null
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
  v_now timestamptz := now();
  v_local_timestamp timestamp;
  v_date date;
  v_local_time time;
  v_distance double precision;
  v_status public.attendance_status;
  v_late_minutes integer;
  v_replay jsonb;
  v_result jsonb;
  v_existing public.attendance_records%rowtype;
  v_placeholder_id uuid := null;
  v_attendance public.attendance_records%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  select * into v_user from public.profiles where id = auth.uid();
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

  v_local_timestamp := v_now at time zone v_settings.timezone;
  v_date := v_local_timestamp::date;
  v_local_time := v_local_timestamp::time;

  select * into v_internship
  from public.internships
  where participant_id = auth.uid()
    and is_active
    and v_date between start_date and end_date;
  if not found then
    raise exception using errcode = 'P0001', message = 'INTERNSHIP_INACTIVE';
  end if;

  if extract(isodow from v_date)::smallint <> all(v_settings.work_days) then
    raise exception using errcode = 'P0001', message = 'NOT_WORK_DAY';
  end if;
  if exists (select 1 from public.holiday_calendar where holiday_date = v_date) then
    raise exception using errcode = 'P0001', message = 'NOT_WORK_DAY';
  end if;

  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception using errcode = 'P0001', message = 'LOCATION_REQUIRED';
  end if;
  if p_accuracy_meters is null or p_accuracy_meters < 0
    or p_accuracy_meters > v_settings.max_location_accuracy_meters then
    raise exception using errcode = 'P0001', message = 'LOCATION_ACCURACY_TOO_LOW';
  end if;
  if p_photo_path is null or trim(p_photo_path) = '' then
    raise exception using errcode = 'P0001', message = 'PHOTO_REQUIRED';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'attendance-photos'
      and o.name = p_photo_path
      and (storage.foldername(o.name))[1] = auth.uid()::text
  ) then
    raise exception using errcode = 'P0001', message = 'PHOTO_REQUIRED';
  end if;
  if p_photo_hash is not null and exists (
    select 1 from public.attendance_records a
    where a.check_in_photo_hash = p_photo_hash
  ) then
    raise exception using errcode = 'P0001', message = 'PHOTO_REUSED';
  end if;

  v_replay := public.claim_operation(p_operation_id, 'CHECK_IN');
  if v_replay is not null then
    return v_replay;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || v_date::text, 0)
  );
  select * into v_existing
  from public.attendance_records
  where participant_id = auth.uid() and attendance_date = v_date;
  if found then
    if v_existing.check_in_at is not null then
      raise exception using errcode = 'P0001', message = 'ALREADY_CHECKED_IN';
    end if;
    if v_existing.status in ('IZIN', 'SAKIT') then
      raise exception using errcode = 'P0001', message = 'ON_APPROVED_LEAVE';
    end if;
    v_placeholder_id := v_existing.id;
  end if;

  v_distance := public.haversine_distance_meters(
    p_latitude,
    p_longitude,
    v_settings.latitude::double precision,
    v_settings.longitude::double precision
  );
  if v_distance > v_settings.radius_meters then
    raise exception using errcode = 'P0001', message = 'LOCATION_OUTSIDE_RADIUS';
  end if;

  v_late_minutes := greatest(
    0,
    floor(extract(epoch from (v_local_time - v_settings.check_in_time)) / 60)::integer
  );
  v_status := case
    when v_local_time <= v_settings.check_in_time
      + make_interval(mins => v_settings.late_tolerance_minutes)
    then 'HADIR'::public.attendance_status
    else 'TERLAMBAT'::public.attendance_status
  end;

  if v_placeholder_id is not null then
    update public.attendance_records set
      internship_id = v_internship.id,
      status = v_status,
      source = 'CHECK_IN',
      leave_request_id = null,
      check_in_at = v_now,
      check_in_photo_path = p_photo_path,
      check_in_latitude = p_latitude,
      check_in_longitude = p_longitude,
      check_in_accuracy_m = p_accuracy_meters,
      check_in_distance_m = v_distance,
      late_minutes = v_late_minutes,
      check_in_photo_hash = nullif(trim(coalesce(p_photo_hash, '')), ''),
      check_in_photo_size = case when coalesce(p_photo_size, 0) > 0 then p_photo_size end,
      policy_snapshot = public.policy_snapshot_for(v_settings)
    where id = v_placeholder_id
    returning * into v_attendance;
  else
    insert into public.attendance_records (
      participant_id, internship_id, attendance_date, status, source,
      check_in_at, check_in_photo_path, check_in_latitude, check_in_longitude,
      check_in_accuracy_m, check_in_distance_m, late_minutes,
      check_in_photo_hash, check_in_photo_size, policy_snapshot
    ) values (
      auth.uid(), v_internship.id, v_date, v_status, 'CHECK_IN',
      v_now, p_photo_path, p_latitude, p_longitude,
      p_accuracy_meters, v_distance, v_late_minutes,
      nullif(trim(coalesce(p_photo_hash, '')), ''),
      case when coalesce(p_photo_size, 0) > 0 then p_photo_size end,
      public.policy_snapshot_for(v_settings)
    ) returning * into v_attendance;
  end if;

  v_result := jsonb_build_object(
    'id', v_attendance.id,
    'date', v_attendance.attendance_date,
    'checkInAt', v_attendance.check_in_at,
    'status', v_attendance.status,
    'lateMinutes', v_attendance.late_minutes,
    'distanceMeters', v_attendance.check_in_distance_m
  );
  perform public.complete_operation(p_operation_id, v_result);
  return v_result;
exception
  when unique_violation then
    if p_photo_hash is not null and exists (
      select 1 from public.attendance_records a
      where a.check_in_photo_hash = p_photo_hash
    ) then
      raise exception using errcode = 'P0001', message = 'PHOTO_REUSED';
    end if;
    raise exception using errcode = 'P0001', message = 'ALREADY_CHECKED_IN';
end;
$$;
