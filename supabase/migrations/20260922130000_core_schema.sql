create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('participant', 'admin');
create type public.institution_type as enum ('SMK', 'UNIVERSITY');
create type public.participant_type as enum ('SMK_PKL', 'UNIVERSITY_INTERN');
create type public.attendance_status as enum ('HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'TIDAK_HADIR');
create type public.leave_request_type as enum ('IZIN', 'SAKIT');
create type public.leave_request_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type public.attendance_source as enum ('CHECK_IN', 'LEAVE', 'ADMIN_CORRECTION');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role public.user_role not null default 'participant',
  full_name varchar(100) not null check (char_length(trim(full_name)) between 2 and 100),
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  phone varchar(30),
  avatar_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique on public.profiles (lower(email));
create index profiles_role_active_idx on public.profiles (role, is_active);

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null check (char_length(trim(name)) between 2 and 150),
  institution_type public.institution_type not null,
  city varchar(100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index institutions_name_type_unique
  on public.institutions (lower(name), institution_type);
create index institutions_active_name_idx on public.institutions (is_active, name);

create table public.internships (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  participant_type public.participant_type not null,
  student_number varchar(50) not null check (char_length(trim(student_number)) between 2 and 50),
  major varchar(100) not null check (char_length(trim(major)) between 2 and 100),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internships_valid_dates check (end_date >= start_date)
);

create unique index internships_institution_student_unique
  on public.internships (institution_id, lower(student_number));
create unique index internships_one_active_per_participant
  on public.internships (participant_id) where is_active;
create index internships_participant_period_idx
  on public.internships (participant_id, start_date, end_date);
create index internships_institution_idx on public.internships (institution_id);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles(id) on delete restrict,
  internship_id uuid not null references public.internships(id) on delete restrict,
  type public.leave_request_type not null,
  start_date date not null,
  end_date date not null,
  reason varchar(500) not null check (char_length(trim(reason)) between 5 and 500),
  attachment_path text,
  status public.leave_request_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_note varchar(500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_valid_dates check (end_date >= start_date),
  constraint leave_requests_review_state check (
    (status = 'PENDING' and reviewed_by is null and reviewed_at is null)
    or (status in ('APPROVED', 'REJECTED') and reviewed_by is not null and reviewed_at is not null)
  )
);

alter table public.leave_requests add constraint leave_requests_no_active_overlap
  exclude using gist (
    participant_id with =,
    internship_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('PENDING', 'APPROVED'));
create index leave_requests_participant_status_idx
  on public.leave_requests (participant_id, status, start_date desc);
create index leave_requests_pending_idx
  on public.leave_requests (created_at) where status = 'PENDING';

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles(id) on delete restrict,
  internship_id uuid not null references public.internships(id) on delete restrict,
  leave_request_id uuid references public.leave_requests(id) on delete restrict,
  attendance_date date not null,
  status public.attendance_status not null,
  source public.attendance_source not null,
  check_in_at timestamptz,
  check_in_photo_path text,
  check_in_latitude numeric(9,6),
  check_in_longitude numeric(9,6),
  check_in_accuracy_m numeric(8,2),
  check_in_distance_m numeric(10,2),
  late_minutes integer not null default 0 check (late_minutes >= 0),
  check_out_at timestamptz,
  check_out_photo_path text,
  corrected_at timestamptz,
  corrected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_unique_participant_date unique (participant_id, attendance_date),
  constraint attendance_valid_latitude check (check_in_latitude is null or check_in_latitude between -90 and 90),
  constraint attendance_valid_longitude check (check_in_longitude is null or check_in_longitude between -180 and 180),
  constraint attendance_valid_accuracy check (check_in_accuracy_m is null or check_in_accuracy_m >= 0),
  constraint attendance_valid_distance check (check_in_distance_m is null or check_in_distance_m >= 0),
  constraint attendance_checkout_after_checkin check (check_out_at is null or (check_in_at is not null and check_out_at >= check_in_at)),
  constraint attendance_checkout_photo_requires_checkout check (check_out_photo_path is null or check_out_at is not null),
  constraint attendance_status_shape check (
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
    )
  )
);

create unique index attendance_check_in_photo_unique
  on public.attendance_records (check_in_photo_path) where check_in_photo_path is not null;
create unique index attendance_check_out_photo_unique
  on public.attendance_records (check_out_photo_path) where check_out_photo_path is not null;
create index attendance_participant_date_idx
  on public.attendance_records (participant_id, attendance_date desc);
create index attendance_internship_date_idx
  on public.attendance_records (internship_id, attendance_date desc);
create index attendance_date_status_idx
  on public.attendance_records (attendance_date desc, status);

create table public.journals (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles(id) on delete restrict,
  internship_id uuid not null references public.internships(id) on delete restrict,
  attendance_id uuid references public.attendance_records(id) on delete set null,
  journal_date date not null,
  content varchar(500) not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journals_unique_participant_date unique (participant_id, journal_date)
);

create index journals_internship_date_idx on public.journals (internship_id, journal_date desc);

create table public.attendance_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true unique check (singleton_key),
  timezone varchar(64) not null default 'Asia/Jakarta',
  work_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  check_in_time time not null default '08:00',
  late_tolerance_minutes integer not null default 15 check (late_tolerance_minutes between 0 and 180),
  check_out_time time not null default '16:00',
  location_name varchar(150) not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  radius_meters integer not null default 150 check (radius_meters between 10 and 10000),
  max_location_accuracy_meters integer not null default 100 check (max_location_accuracy_meters between 5 and 1000),
  require_checkout_photo boolean not null default false,
  max_journal_length integer not null default 500 check (max_journal_length between 1 and 500),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint attendance_settings_work_days_valid check (
    cardinality(work_days) between 1 and 7
    and work_days <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint attendance_settings_checkout_after_checkin check (check_out_time > check_in_time)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action varchar(100) not null,
  entity_type varchar(100) not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger institutions_set_updated_at before update on public.institutions
for each row execute function public.set_updated_at();
create trigger internships_set_updated_at before update on public.internships
for each row execute function public.set_updated_at();
create trigger leave_requests_set_updated_at before update on public.leave_requests
for each row execute function public.set_updated_at();
create trigger attendance_records_set_updated_at before update on public.attendance_records
for each row execute function public.set_updated_at();
create trigger journals_set_updated_at before update on public.journals
for each row execute function public.set_updated_at();

comment on table public.attendance_records is 'Authoritative attendance records; direct participant writes are denied by RLS.';
comment on column public.attendance_records.source is 'Provenance for check-in, approved leave, or admin correction.';
comment on table public.audit_logs is 'Append-only administrative audit trail.';
