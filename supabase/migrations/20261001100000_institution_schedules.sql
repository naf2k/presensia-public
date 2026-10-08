-- Jadwal khusus per institusi (kasus: Universitas Pamulang).
-- Tabel institution_day_schedules: hari yang terdaftar = hari kerja
-- institusi itu; kolom waktu null = ikut setting global. Institusi tanpa
-- baris sama sekali memakai setting global penuh (perilaku lama).
-- Fungsi engine kini memakai jadwal efektif via public.schedule_for().

create table public.institution_day_schedules (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  check_in_time time null,
  check_out_time time null,
  late_tolerance_minutes integer null check (late_tolerance_minutes between 0 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_day_schedules_unique unique (institution_id, weekday)
);

alter table public.institution_day_schedules enable row level security;

create policy institution_schedules_select_related_or_admin
on public.institution_day_schedules for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1 from public.internships i
    where i.institution_id = institution_day_schedules.institution_id
      and i.participant_id = auth.uid()
  )
);
create policy institution_schedules_admin_write
on public.institution_day_schedules for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

grant select, insert, update, delete on public.institution_day_schedules to authenticated;

create or replace function public.schedule_for(p_institution_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.attendance_settings%rowtype;
  v_wd smallint := extract(isodow from p_date)::smallint;
  v_has boolean;
  v_row public.institution_day_schedules%rowtype;
  v_days smallint[];
begin
  select * into v_settings from public.attendance_settings where singleton_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;
  select exists(
    select 1 from public.institution_day_schedules s
    where s.institution_id = p_institution_id
  ) into v_has;
  if v_has then
    select array_agg(s.weekday order by s.weekday) into v_days
    from public.institution_day_schedules s
    where s.institution_id = p_institution_id;
    select * into v_row from public.institution_day_schedules s
    where s.institution_id = p_institution_id and s.weekday = v_wd;
    if not found then
      return jsonb_build_object(
        'workDay', false, 'hasOverride', true,
        'checkIn', v_settings.check_in_time::text,
        'checkOut', v_settings.check_out_time::text,
        'tolerance', v_settings.late_tolerance_minutes,
        'workDays', to_jsonb(v_days)
      );
    end if;
    return jsonb_build_object(
      'workDay', true, 'hasOverride', true,
      'checkIn', coalesce(v_row.check_in_time, v_settings.check_in_time)::text,
      'checkOut', coalesce(v_row.check_out_time, v_settings.check_out_time)::text,
      'tolerance', coalesce(v_row.late_tolerance_minutes, v_settings.late_tolerance_minutes),
      'workDays', to_jsonb(v_days)
    );
  end if;
  return jsonb_build_object(
    'workDay', v_wd = any (v_settings.work_days),
    'hasOverride', false,
    'checkIn', v_settings.check_in_time::text,
    'checkOut', v_settings.check_out_time::text,
    'tolerance', v_settings.late_tolerance_minutes,
    'workDays', to_jsonb(v_settings.work_days)
  );
end;
$$;

revoke all on function public.schedule_for(uuid, date) from public;
grant execute on function public.schedule_for(uuid, date) to authenticated;

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
  v_sched jsonb;
  v_ci time;
  v_co time;
  v_tol integer;
  v_snapshot jsonb;
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

  v_sched := public.schedule_for(v_internship.institution_id, v_date);
  v_ci := (v_sched->>'checkIn')::time;
  v_co := (v_sched->>'checkOut')::time;
  v_tol := (v_sched->>'tolerance')::integer;
  v_snapshot := public.policy_snapshot_for(v_settings) || jsonb_build_object(
    'workDays', v_sched->'workDays',
    'checkInTime', v_sched->>'checkIn',
    'checkOutTime', v_sched->>'checkOut',
    'lateToleranceMinutes', (v_sched->>'tolerance')::integer
  );
  if not (v_sched->>'workDay')::boolean then
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
    floor(extract(epoch from (
      v_local_time - v_ci
        - make_interval(mins => v_tol)
    )) / 60)::integer
  );
  v_status := case
    when v_local_time <= v_ci
      + make_interval(mins => v_tol)
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
      policy_snapshot = v_snapshot
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
      v_snapshot
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

create or replace function public.perform_check_out(
  p_journal_content text default null,
  p_photo_path text default null,
  p_operation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.profiles%rowtype;
  v_settings public.attendance_settings%rowtype;
  v_attendance public.attendance_records%rowtype;
  v_institution_id uuid;
  v_sched jsonb;
  v_ci time;
  v_co time;
  v_tol integer;
  v_snapshot jsonb;
  v_now timestamptz := now();
  v_date date;
  v_local_time time;
  v_content text := nullif(trim(p_journal_content), '');
  v_early integer;
  v_duration integer;
  v_replay jsonb;
  v_result jsonb;
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
  v_date := (v_now at time zone v_settings.timezone)::date;
  v_local_time := (v_now at time zone v_settings.timezone)::time;

  v_replay := public.claim_operation(p_operation_id, 'CHECK_OUT');
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_attendance
  from public.attendance_records
  where participant_id = auth.uid() and attendance_date = v_date
  for update;
  if not found or v_attendance.check_in_at is null then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_NOT_FOUND';
  end if;
  if v_attendance.check_out_at is not null then
    raise exception using errcode = 'P0001', message = 'ALREADY_CHECKED_OUT';
  end if;
  select i.institution_id into v_institution_id
  from public.internships i where i.id = v_attendance.internship_id;
  v_sched := public.schedule_for(v_institution_id, v_date);
  v_co := (v_sched->>'checkOut')::time;

  if v_settings.require_checkout_photo and nullif(trim(p_photo_path), '') is null then
    raise exception using errcode = 'P0001', message = 'CHECKOUT_PHOTO_REQUIRED';
  end if;
  if p_photo_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'attendance-photos'
      and o.name = p_photo_path
      and (storage.foldername(o.name))[1] = auth.uid()::text
  ) then
    raise exception using errcode = 'P0001', message = 'PHOTO_REQUIRED';
  end if;
  if v_content is not null and char_length(v_content) > v_settings.max_journal_length then
    raise exception using errcode = 'P0001', message = 'JOURNAL_TOO_LONG';
  end if;

  v_early := greatest(
    0,
    floor(extract(epoch from (v_co - v_local_time)) / 60)::integer
  );
  v_duration := greatest(
    0,
    floor(extract(epoch from (v_now - v_attendance.check_in_at)) / 60)::integer
  );

  update public.attendance_records
  set check_out_at = v_now,
      check_out_photo_path = nullif(trim(p_photo_path), ''),
      early_checkout_minutes = v_early,
      work_duration_minutes = v_duration
  where id = v_attendance.id
  returning * into v_attendance;

  if v_content is not null then
    insert into public.journals (
      participant_id, internship_id, attendance_id, journal_date, content
    ) values (
      auth.uid(), v_attendance.internship_id, v_attendance.id, v_date, v_content
    )
    on conflict (participant_id, journal_date) do update
      set content = excluded.content,
          attendance_id = excluded.attendance_id,
          internship_id = excluded.internship_id;
  end if;

  v_result := jsonb_build_object(
    'id', v_attendance.id,
    'date', v_attendance.attendance_date,
    'checkOutAt', v_attendance.check_out_at,
    'earlyCheckoutMinutes', v_attendance.early_checkout_minutes,
    'workDurationMinutes', v_attendance.work_duration_minutes
  );
  perform public.complete_operation(p_operation_id, v_result);
  return v_result;
end;
$$;

create or replace function public.admin_correct_attendance(
  p_attendance_id uuid,
  p_reason text,
  p_status public.attendance_status default null,
  p_check_in_at timestamptz default null,
  p_check_out_at timestamptz default null
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
  v_inst_id uuid;
  v_sched jsonb;
  v_ci time;
  v_co time;
  v_tol integer;
  v_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = 'P0001', message = 'CORRECTION_REASON_REQUIRED';
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

  select i.institution_id into v_inst_id
  from public.internships i where i.id = v_before.internship_id;
  v_sched := public.schedule_for(v_inst_id, v_before.attendance_date);
  v_ci := (v_sched->>'checkIn')::time;
  v_co := (v_sched->>'checkOut')::time;
  v_tol := (v_sched->>'tolerance')::integer;
  v_snapshot := public.policy_snapshot_for(v_settings) || jsonb_build_object(
    'workDays', v_sched->'workDays',
    'checkInTime', v_sched->>'checkIn',
    'checkOutTime', v_sched->>'checkOut',
    'lateToleranceMinutes', (v_sched->>'tolerance')::integer
  );

  v_final_check_in := case
    when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null
    else coalesce(p_check_in_at, v_before.check_in_at)
  end;
  v_late := case
    when v_final_check_in is null then 0
    else greatest(
      0,
      floor(extract(epoch from (
        (v_final_check_in at time zone v_settings.timezone)::time - v_ci
          - make_interval(mins => v_tol)
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

  return to_jsonb(v_after);
end;
$$;

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
  v_inst_id uuid;
  v_sched jsonb;
  v_ci time;
  v_co time;
  v_tol integer;
  v_snapshot jsonb;
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

  select i.institution_id into v_inst_id
  from public.internships i where i.id = v_before.internship_id;
  v_sched := public.schedule_for(v_inst_id, v_before.attendance_date);
  v_ci := (v_sched->>'checkIn')::time;
  v_co := (v_sched->>'checkOut')::time;
  v_tol := (v_sched->>'tolerance')::integer;
  v_snapshot := public.policy_snapshot_for(v_settings) || jsonb_build_object(
    'workDays', v_sched->'workDays',
    'checkInTime', v_sched->>'checkIn',
    'checkOutTime', v_sched->>'checkOut',
    'lateToleranceMinutes', (v_sched->>'tolerance')::integer
  );

  v_final_check_in := case
    when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null
    else coalesce(p_check_in_at, v_before.check_in_at)
  end;
  v_late := case
    when v_final_check_in is null then 0
    else greatest(
      0,
      floor(extract(epoch from (
        (v_final_check_in at time zone v_settings.timezone)::time - v_ci
          - make_interval(mins => v_tol)
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
  p_accuracy_meters double precision default null
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
  v_sched jsonb;
  v_ci time;
  v_co time;
  v_tol integer;
  v_snapshot jsonb;
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

  v_sched := public.schedule_for(v_internship.institution_id, p_date);
  v_ci := (v_sched->>'checkIn')::time;
  v_co := (v_sched->>'checkOut')::time;
  v_tol := (v_sched->>'tolerance')::integer;
  v_snapshot := public.policy_snapshot_for(v_settings) || jsonb_build_object(
    'workDays', v_sched->'workDays',
    'checkInTime', v_sched->>'checkIn',
    'checkOutTime', v_sched->>'checkOut',
    'lateToleranceMinutes', (v_sched->>'tolerance')::integer
  );
  if not (v_sched->>'workDay')::boolean then
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

  if p_status in ('HADIR', 'TERLAMBAT') then
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
    v_late := greatest(
      0,
      floor(extract(epoch from (
        v_local_check_in - v_ci
          - make_interval(mins => v_tol)
      )) / 60)::integer
    );
    if p_status = 'HADIR'
      and v_local_check_in > v_ci
        + make_interval(mins => v_tol) then
      p_status := 'TERLAMBAT';
    end if;
  end if;

  insert into public.attendance_records (
    participant_id, internship_id, attendance_date, status, source,
    check_in_at, check_in_photo_path, check_in_latitude, check_in_longitude,
    check_in_accuracy_m, check_in_distance_m, late_minutes,
    check_out_at, corrected_by, corrected_at, policy_snapshot
  ) values (
    p_participant_id, v_internship.id, p_date, p_status, 'ADMIN_CORRECTION',
    case when p_status in ('HADIR', 'TERLAMBAT') then p_check_in_at end,
    case when p_status in ('HADIR', 'TERLAMBAT') then nullif(trim(p_photo_path), '') end,
    case when p_status in ('HADIR', 'TERLAMBAT') then p_latitude end,
    case when p_status in ('HADIR', 'TERLAMBAT') then p_longitude end,
    case when p_status in ('HADIR', 'TERLAMBAT') then p_accuracy_meters end,
    case when p_status in ('HADIR', 'TERLAMBAT') then v_distance end,
    v_late,
    case when p_status in ('HADIR', 'TERLAMBAT') then p_check_out_at end,
    auth.uid(), now(),
    v_snapshot
  ) returning * into v_record;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, after_data, reason
  ) values (
    auth.uid(), 'ATTENDANCE_CREATED', 'attendance_record', v_record.id::text,
    to_jsonb(v_record), trim(p_reason)
  );

  return to_jsonb(v_record);
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_ALREADY_EXISTS';
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
  v_sched jsonb;
  v_ci time;
  v_co time;
  v_tol integer;
  v_snapshot jsonb;
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

  v_sched := public.schedule_for(v_internship.institution_id, p_date);
  v_ci := (v_sched->>'checkIn')::time;
  v_co := (v_sched->>'checkOut')::time;
  v_tol := (v_sched->>'tolerance')::integer;
  v_snapshot := public.policy_snapshot_for(v_settings) || jsonb_build_object(
    'workDays', v_sched->'workDays',
    'checkInTime', v_sched->>'checkIn',
    'checkOutTime', v_sched->>'checkOut',
    'lateToleranceMinutes', (v_sched->>'tolerance')::integer
  );
  if not (v_sched->>'workDay')::boolean then
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
    v_late := greatest(
      0,
      floor(extract(epoch from (
        v_local_check_in - v_ci
          - make_interval(mins => v_tol)
      )) / 60)::integer
    );
    if v_status = 'HADIR'
      and v_local_check_in > v_ci
        + make_interval(mins => v_tol) then
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
    v_snapshot
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

create or replace function public.materialize_absences(p_target_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.attendance_settings%rowtype;
  v_today date;
  v_target date;
  v_created integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  select * into v_settings from public.attendance_settings where singleton_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;
  v_today := (now() at time zone v_settings.timezone)::date;
  v_target := coalesce(p_target_date, v_today - 1);
  if v_target >= v_today then
    raise exception using errcode = 'P0001', message = 'INVALID_DATE';
  end if;
  if extract(isodow from v_target)::smallint <> all(v_settings.work_days) then
    raise exception using errcode = 'P0001', message = 'NOT_WORK_DAY';
  end if;
  if exists (select 1 from public.holiday_calendar where holiday_date = v_target) then
    raise exception using errcode = 'P0001', message = 'NOT_WORK_DAY';
  end if;

  with candidates as (
    select p.id as participant_id, i.id as internship_id
    from public.profiles p
    join public.internships i
      on i.participant_id = p.id
      and i.is_active
      and v_target between i.start_date and i.end_date
    where p.role = 'participant'
      and p.is_active
      and (public.schedule_for(i.institution_id, v_target)->>'workDay')::boolean
      and not exists (
        select 1 from public.attendance_records a
        where a.participant_id = p.id and a.attendance_date = v_target
      )
      and not exists (
        select 1 from public.leave_requests l
        where l.participant_id = p.id
          and l.status = 'APPROVED'
          and v_target between l.start_date and l.end_date
      )
  ),
  inserted as (
    insert into public.attendance_records (
      participant_id, internship_id, attendance_date, status, source,
      late_minutes, policy_snapshot
    )
    select
      participant_id, internship_id, v_target, 'TIDAK_HADIR', 'ADMIN_CORRECTION',
      0, jsonb_build_object('autoAbsence', true)
    from candidates
    on conflict (participant_id, attendance_date) do nothing
    returning id
  )
  select count(*) into v_created from inserted;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, after_data, reason
  ) values (
    auth.uid(), 'ABSENCES_MATERIALIZED', 'attendance_date', v_target::text,
    jsonb_build_object('created', v_created),
    'Nightly absence materialization.'
  );

  return jsonb_build_object('date', v_target, 'created', v_created);
end;
$$;


-- Jadwal efektif peserta login (untuk tampilan aplikasi).
create or replace function public.my_schedule()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.attendance_settings%rowtype;
  v_internship public.internships%rowtype;
  v_today date;
  v_sched jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  select * into v_settings from public.attendance_settings where singleton_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;
  v_today := (now() at time zone v_settings.timezone)::date;
  select * into v_internship from public.internships
  where participant_id = auth.uid()
    and is_active
    and v_today between start_date and end_date;
  if found then
    v_sched := public.schedule_for(v_internship.institution_id, v_today);
  else
    v_sched := public.schedule_for(null, v_today);
  end if;
  return v_sched || jsonb_build_object(
    'date', v_today,
    'timezone', v_settings.timezone
  );
end;
$$;

revoke all on function public.my_schedule() from public;
grant execute on function public.my_schedule() to authenticated;

-- Seed awal: Universitas Pamulang (Selasa & Rabu 14:00-16:00 tol 30;
-- Kamis ikut global; Senin & Jumat bukan hari kerja).
insert into public.institution_day_schedules
  (institution_id, weekday, check_in_time, check_out_time, late_tolerance_minutes)
values
  ('e3a814ce-f773-48ef-a800-9b2356c37fde', 2, '14:00', '16:00', 30),
  ('e3a814ce-f773-48ef-a800-9b2356c37fde', 3, '14:00', '16:00', 30),
  ('e3a814ce-f773-48ef-a800-9b2356c37fde', 4, null, null, null)
on conflict (institution_id, weekday) do update set
  check_in_time = excluded.check_in_time,
  check_out_time = excluded.check_out_time,
  late_tolerance_minutes = excluded.late_tolerance_minutes,
  updated_at = now();
