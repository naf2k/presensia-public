create or replace function public.validate_leave_request_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'PENDING' or new.reviewed_by is not null or new.reviewed_at is not null then
    raise exception using errcode = 'P0001', message = 'INVALID_LEAVE_STATE';
  end if;

  if exists (
    select 1 from public.attendance_records a
    where a.participant_id = new.participant_id
      and a.attendance_date between new.start_date and new.end_date
  ) then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_ALREADY_EXISTS';
  end if;

  if new.attachment_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'leave-attachments'
      and o.name = new.attachment_path
      and (storage.foldername(o.name))[1] = new.participant_id::text
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_ATTACHMENT';
  end if;

  return new;
end;
$$;

create trigger leave_requests_validate_insert
before insert on public.leave_requests
for each row execute function public.validate_leave_request_insert();

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
    check_in_accuracy_m, check_in_distance_m, late_minutes
  ) values (
    auth.uid(), v_internship.id, v_date, v_status, 'CHECK_IN',
    v_now, p_photo_path, p_latitude, p_longitude,
    p_accuracy_meters, v_distance, v_late_minutes
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
  v_content text := nullif(trim(p_journal_content), '');
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

  update public.attendance_records
  set check_out_at = v_now,
      check_out_photo_path = nullif(trim(p_photo_path), '')
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
    'checkOutAt', v_attendance.check_out_at
  );
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
  v_status public.attendance_status;
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

  update public.attendance_records set
    status = v_status,
    source = 'ADMIN_CORRECTION',
    leave_request_id = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else leave_request_id end,
    check_in_at = case
      when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null
      else coalesce(p_check_in_at, check_in_at)
    end,
    check_in_photo_path = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_photo_path end,
    check_in_latitude = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_latitude end,
    check_in_longitude = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_longitude end,
    check_in_accuracy_m = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_accuracy_m end,
    check_in_distance_m = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then null else check_in_distance_m end,
    late_minutes = case when v_status in ('IZIN', 'SAKIT', 'TIDAK_HADIR') then 0 else late_minutes end,
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
    where extract(isodow from d)::smallint = any(v_settings.work_days);
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

create or replace function public.admin_update_attendance_settings(
  p_work_days smallint[],
  p_check_in_time time,
  p_late_tolerance_minutes integer,
  p_check_out_time time,
  p_location_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer,
  p_max_location_accuracy_meters integer,
  p_require_checkout_photo boolean,
  p_max_journal_length integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.attendance_settings%rowtype;
  v_after public.attendance_settings%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;
  if cardinality(p_work_days) <> (select count(distinct day) from unnest(p_work_days) day) then
    raise exception using errcode = 'P0001', message = 'INVALID_WORK_DAYS';
  end if;

  select * into v_before from public.attendance_settings where singleton_key for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;

  update public.attendance_settings set
    work_days = p_work_days,
    check_in_time = p_check_in_time,
    late_tolerance_minutes = p_late_tolerance_minutes,
    check_out_time = p_check_out_time,
    location_name = trim(p_location_name),
    latitude = p_latitude,
    longitude = p_longitude,
    radius_meters = p_radius_meters,
    max_location_accuracy_meters = p_max_location_accuracy_meters,
    require_checkout_photo = p_require_checkout_photo,
    max_journal_length = p_max_journal_length,
    updated_by = auth.uid(),
    updated_at = now()
  where singleton_key
  returning * into v_after;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    auth.uid(), 'ATTENDANCE_SETTINGS_UPDATED', 'attendance_settings', v_after.id::text,
    to_jsonb(v_before), to_jsonb(v_after)
  );

  return to_jsonb(v_after);
end;
$$;

revoke all on function public.validate_leave_request_insert() from public;
revoke all on function public.perform_check_in(text, double precision, double precision, double precision) from public;
revoke all on function public.perform_check_out(text, text) from public;
revoke all on function public.admin_correct_attendance(uuid, text, public.attendance_status, timestamptz, timestamptz) from public;
revoke all on function public.admin_review_leave(uuid, public.leave_request_status, text) from public;
revoke all on function public.admin_update_attendance_settings(smallint[], time, integer, time, text, double precision, double precision, integer, integer, boolean, integer) from public;

grant execute on function public.perform_check_in(text, double precision, double precision, double precision) to authenticated;
grant execute on function public.perform_check_out(text, text) to authenticated;
grant execute on function public.admin_correct_attendance(uuid, text, public.attendance_status, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_review_leave(uuid, public.leave_request_status, text) to authenticated;
grant execute on function public.admin_update_attendance_settings(smallint[], time, integer, time, text, double precision, double precision, integer, integer, boolean, integer) to authenticated;

comment on function public.perform_check_in(text, double precision, double precision, double precision)
  is 'Atomic server-authoritative check-in operation.';
comment on function public.admin_correct_attendance(uuid, text, public.attendance_status, timestamptz, timestamptz)
  is 'Admin-only attendance correction with an append-only audit record.';
