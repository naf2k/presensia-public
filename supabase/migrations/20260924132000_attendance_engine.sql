-- Fase 3: authoritative attendance engine.
-- 1. Policy snapshots + early checkout + work duration on attendance rows.
-- 2. Holiday calendar respected by check-in, leave materialization, and absence job.
-- 3. Nightly TIDAK_HADIR materialization (pg_cron when available).
-- 4. Admin creation of missing attendance rows with audit.
-- 5. Late minutes are recomputed on correction.

alter table public.attendance_records
  add column if not exists early_checkout_minutes integer not null default 0
    check (early_checkout_minutes >= 0),
  add column if not exists work_duration_minutes integer
    check (work_duration_minutes is null or work_duration_minutes >= 0),
  add column if not exists policy_snapshot jsonb;

-- ---------------------------------------------------------------------------
-- Holiday calendar
-- ---------------------------------------------------------------------------

create table if not exists public.holiday_calendar (
  holiday_date date primary key,
  name text not null check (char_length(trim(name)) between 2 and 120),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.holiday_calendar enable row level security;

drop policy if exists holiday_authenticated_select on public.holiday_calendar;
create policy holiday_authenticated_select
on public.holiday_calendar for select to authenticated
using (true);

drop policy if exists holiday_admin_insert on public.holiday_calendar;
create policy holiday_admin_insert
on public.holiday_calendar for insert to authenticated
with check ((select public.is_admin()));

drop policy if exists holiday_admin_update on public.holiday_calendar;
create policy holiday_admin_update
on public.holiday_calendar for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists holiday_admin_delete on public.holiday_calendar;
create policy holiday_admin_delete
on public.holiday_calendar for delete to authenticated
using ((select public.is_admin()));

grant usage on schema public to authenticated;
grant select on public.holiday_calendar to authenticated;
grant insert, update, delete on public.holiday_calendar to authenticated;
revoke insert, update, delete on public.holiday_calendar from anon;

-- ---------------------------------------------------------------------------
-- Shape constraint: leave/absence rows carry no checkout metrics;
-- auto-absence rows are marked inside policy_snapshot.
-- ---------------------------------------------------------------------------

alter table public.attendance_records drop constraint if exists attendance_status_shape;

alter table public.attendance_records add constraint attendance_status_shape check (
  (
    status in ('HADIR', 'TERLAMBAT')
    and source in ('CHECK_IN', 'ADMIN_CORRECTION')
    and leave_request_id is null
    and check_in_at is not null
    and check_in_photo_path is not null
    and check_in_latitude is not null
    and check_in_longitude is not null
    and check_in_accuracy_m is not null
    and check_in_distance_m is not null
  )
  or (
    status in ('IZIN', 'SAKIT')
    and check_in_at is null
    and check_in_photo_path is null
    and check_in_latitude is null
    and check_in_longitude is null
    and check_in_accuracy_m is null
    and check_in_distance_m is null
    and check_out_at is null
    and check_out_photo_path is null
    and late_minutes = 0
    and early_checkout_minutes = 0
    and work_duration_minutes is null
    and (
      (source = 'LEAVE' and leave_request_id is not null)
      or (source = 'ADMIN_CORRECTION' and leave_request_id is null)
    )
  )
  or (
    status = 'TIDAK_HADIR'
    and source = 'ADMIN_CORRECTION'
    and leave_request_id is null
    and check_in_at is null
    and check_in_photo_path is null
    and check_in_latitude is null
    and check_in_longitude is null
    and check_in_accuracy_m is null
    and check_in_distance_m is null
    and check_out_at is null
    and check_out_photo_path is null
    and late_minutes = 0
    and early_checkout_minutes = 0
    and work_duration_minutes is null
  )
);

-- ---------------------------------------------------------------------------
-- Shared snapshot helper
-- ---------------------------------------------------------------------------

create or replace function public.policy_snapshot_for(
  p_settings public.attendance_settings
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'timezone', p_settings.timezone,
    'workDays', p_settings.work_days,
    'checkInTime', p_settings.check_in_time,
    'checkOutTime', p_settings.check_out_time,
    'lateToleranceMinutes', p_settings.late_tolerance_minutes,
    'locationName', p_settings.location_name,
    'latitude', p_settings.latitude,
    'longitude', p_settings.longitude,
    'radiusMeters', p_settings.radius_meters,
    'maxAccuracyMeters', p_settings.max_location_accuracy_meters
  );
$$;

-- ---------------------------------------------------------------------------
-- Check-in: holiday guard + snapshot
-- ---------------------------------------------------------------------------

create or replace function public.perform_check_in(
  p_photo_path text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || v_date::text, 0)
  );
  if exists (
    select 1 from public.attendance_records
    where participant_id = auth.uid() and attendance_date = v_date
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_CHECKED_IN';
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

  insert into public.attendance_records (
    participant_id, internship_id, attendance_date, status, source,
    check_in_at, check_in_photo_path, check_in_latitude, check_in_longitude,
    check_in_accuracy_m, check_in_distance_m, late_minutes, policy_snapshot
  ) values (
    auth.uid(), v_internship.id, v_date, v_status, 'CHECK_IN',
    v_now, p_photo_path, p_latitude, p_longitude,
    p_accuracy_meters, v_distance, v_late_minutes,
    public.policy_snapshot_for(v_settings)
  ) returning * into v_attendance;

  return jsonb_build_object(
    'id', v_attendance.id,
    'date', v_attendance.attendance_date,
    'checkInAt', v_attendance.check_in_at,
    'status', v_attendance.status,
    'lateMinutes', v_attendance.late_minutes,
    'distanceMeters', v_attendance.check_in_distance_m
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ALREADY_CHECKED_IN';
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-out: early minutes + work duration (schedule never rejects)
-- ---------------------------------------------------------------------------

create or replace function public.perform_check_out(
  p_journal_content text default null,
  p_photo_path text default null
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
  v_now timestamptz := now();
  v_date date;
  v_local_time time;
  v_content text := nullif(trim(p_journal_content), '');
  v_early integer;
  v_duration integer;
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
    floor(extract(epoch from (v_settings.check_out_time - v_local_time)) / 60)::integer
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

  return jsonb_build_object(
    'id', v_attendance.id,
    'date', v_attendance.attendance_date,
    'checkOutAt', v_attendance.check_out_at,
    'earlyCheckoutMinutes', v_attendance.early_checkout_minutes,
    'workDurationMinutes', v_attendance.work_duration_minutes
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Leave approval skips holidays
-- ---------------------------------------------------------------------------

create or replace function public.admin_review_leave(
  p_leave_request_id uuid,
  p_decision public.leave_request_status,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.leave_requests%rowtype;
  v_after public.leave_requests%rowtype;
  v_settings public.attendance_settings%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception using errcode = 'P0001', message = 'INVALID_LEAVE_DECISION';
  end if;
  if char_length(coalesce(p_admin_note, '')) > 500 then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOTE_TOO_LONG';
  end if;

  select * into v_before from public.leave_requests
  where id = p_leave_request_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'LEAVE_REQUEST_NOT_FOUND';
  end if;
  if v_before.status <> 'PENDING' then
    raise exception using errcode = 'P0001', message = 'LEAVE_ALREADY_REVIEWED';
  end if;

  select * into v_settings from public.attendance_settings where singleton_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;

  if p_decision = 'APPROVED' and exists (
    select 1
    from generate_series(v_before.start_date, v_before.end_date, interval '1 day') d
    join public.attendance_records a
      on a.participant_id = v_before.participant_id
      and a.attendance_date = d::date
    where extract(isodow from d)::smallint = any(v_settings.work_days)
  ) then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_ALREADY_EXISTS';
  end if;

  update public.leave_requests set
    status = p_decision,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_note = nullif(trim(p_admin_note), '')
  where id = p_leave_request_id
  returning * into v_after;

  if p_decision = 'APPROVED' then
    insert into public.attendance_records (
      participant_id, internship_id, leave_request_id, attendance_date,
      status, source, late_minutes
    )
    select
      v_before.participant_id,
      v_before.internship_id,
      v_before.id,
      d::date,
      v_before.type::text::public.attendance_status,
      'LEAVE',
      0
    from generate_series(v_before.start_date, v_before.end_date, interval '1 day') d
    where extract(isodow from d)::smallint = any(v_settings.work_days)
      and not exists (
        select 1 from public.holiday_calendar h where h.holiday_date = d::date
      );
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, reason
  ) values (
    auth.uid(),
    case when p_decision = 'APPROVED' then 'LEAVE_APPROVED' else 'LEAVE_REJECTED' end,
    'leave_request', v_before.id::text, to_jsonb(v_before), to_jsonb(v_after),
    nullif(trim(p_admin_note), '')
  );

  return to_jsonb(v_after);
end;
$$;

-- ---------------------------------------------------------------------------
-- Correction recomputes lateness and resets checkout metrics for absences
-- ---------------------------------------------------------------------------

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

  v_final_check_in := case
    when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null
    else coalesce(p_check_in_at, v_before.check_in_at)
  end;
  v_late := case
    when v_final_check_in is null then 0
    else greatest(
      0,
      floor(extract(epoch from (
        (v_final_check_in at time zone v_settings.timezone)::time - v_settings.check_in_time
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

-- ---------------------------------------------------------------------------
-- Admin creation of a missing attendance row
-- ---------------------------------------------------------------------------

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
      floor(extract(epoch from (v_local_check_in - v_settings.check_in_time)) / 60)::integer
    );
    if p_status = 'HADIR'
      and v_local_check_in > v_settings.check_in_time
        + make_interval(mins => v_settings.late_tolerance_minutes) then
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
    public.policy_snapshot_for(v_settings)
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

-- ---------------------------------------------------------------------------
-- Nightly absence materialization (admin JWT, service role, or pg_cron)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Grants + nightly schedule (10:05 UTC = 17:05 WIB)
-- ---------------------------------------------------------------------------

revoke all on function public.policy_snapshot_for(public.attendance_settings) from public;
revoke all on function public.admin_create_attendance(uuid, date, public.attendance_status, text, timestamptz, timestamptz, text, double precision, double precision, double precision) from public;
revoke all on function public.materialize_absences(date) from public;
grant execute on function public.admin_create_attendance(uuid, date, public.attendance_status, text, timestamptz, timestamptz, text, double precision, double precision, double precision) to authenticated;
grant execute on function public.materialize_absences(date) to authenticated;

comment on function public.materialize_absences(date)
  is 'Creates TIDAK_HADIR rows for active participants missing attendance on a past workday.';

do $cron_block$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'materialize-absences-nightly') then
      perform cron.schedule(
        'materialize-absences-nightly',
        '5 10 * * *',
        $$select public.materialize_absences(null)$$
      );
    end if;
  end if;
end;
$cron_block$;
