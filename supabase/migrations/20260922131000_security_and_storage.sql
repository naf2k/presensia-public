create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active
  );
$$;

create or replace function public.operational_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select timezone from public.attendance_settings where singleton_key limit 1),
    'Asia/Jakarta'
  ))::date;
$$;

create or replace function public.haversine_distance_meters(
  latitude_a double precision,
  longitude_a double precision,
  latitude_b double precision,
  longitude_b double precision
)
returns double precision
language sql
immutable
strict
set search_path = ''
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(latitude_b - latitude_a) / 2), 2)
    + cos(radians(latitude_a)) * cos(radians(latitude_b))
    * power(sin(radians(longitude_b - longitude_a) / 2), 2)
  ));
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.operational_date() from public;
revoke all on function public.haversine_distance_meters(double precision, double precision, double precision, double precision) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.operational_date() to authenticated;

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.internships enable row level security;
alter table public.attendance_records enable row level security;
alter table public.journals enable row level security;
alter table public.leave_requests enable row level security;
alter table public.attendance_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own_or_admin
on public.profiles for select to authenticated
using (id = auth.uid() or (select public.is_admin()));

create policy institutions_select_related_or_admin
on public.institutions for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1 from public.internships i
    where i.institution_id = institutions.id
      and i.participant_id = auth.uid()
  )
);

create policy institutions_admin_insert
on public.institutions for insert to authenticated
with check ((select public.is_admin()));
create policy institutions_admin_update
on public.institutions for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy internships_select_own_or_admin
on public.internships for select to authenticated
using (participant_id = auth.uid() or (select public.is_admin()));

create policy attendance_select_own_or_admin
on public.attendance_records for select to authenticated
using (participant_id = auth.uid() or (select public.is_admin()));

create policy journals_select_own_or_admin
on public.journals for select to authenticated
using (participant_id = auth.uid() or (select public.is_admin()));

create policy journals_participant_insert
on public.journals for insert to authenticated
with check (
  participant_id = auth.uid()
  and journal_date = (select public.operational_date())
  and exists (
    select 1 from public.internships i
    where i.id = internship_id
      and i.participant_id = auth.uid()
      and i.is_active
      and journal_date between i.start_date and i.end_date
  )
  and char_length(content) <= coalesce(
    (select max_journal_length from public.attendance_settings where singleton_key),
    500
  )
);

create policy journals_participant_update
on public.journals for update to authenticated
using (participant_id = auth.uid() and journal_date = (select public.operational_date()))
with check (
  participant_id = auth.uid()
  and journal_date = (select public.operational_date())
  and char_length(content) <= coalesce(
    (select max_journal_length from public.attendance_settings where singleton_key),
    500
  )
);

create policy leave_requests_select_own_or_admin
on public.leave_requests for select to authenticated
using (participant_id = auth.uid() or (select public.is_admin()));

create policy leave_requests_participant_insert
on public.leave_requests for insert to authenticated
with check (
  participant_id = auth.uid()
  and status = 'PENDING'
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1 from public.internships i
    where i.id = internship_id
      and i.participant_id = auth.uid()
      and i.is_active
      and start_date >= i.start_date
      and end_date <= i.end_date
  )
);

create policy settings_authenticated_select
on public.attendance_settings for select to authenticated
using (true);

create policy audit_logs_admin_select
on public.audit_logs for select to authenticated
using ((select public.is_admin()));

grant usage on schema public to authenticated;
grant select on public.profiles, public.institutions, public.internships,
  public.attendance_records, public.journals, public.leave_requests,
  public.attendance_settings, public.audit_logs to authenticated;
grant insert, update on public.journals to authenticated;
grant insert on public.leave_requests to authenticated;
grant insert, update on public.institutions to authenticated;

revoke insert, update, delete on public.attendance_records from anon, authenticated;
revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke insert, update, delete on public.attendance_settings from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.internships from anon, authenticated;
revoke update, delete on public.leave_requests from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attendance-photos', 'attendance-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('leave-attachments', 'leave-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_insert_own_prefix
on storage.objects for insert to authenticated
with check (
  bucket_id in ('attendance-photos', 'leave-attachments', 'avatars')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy storage_select_own_or_admin
on storage.objects for select to authenticated
using (
  bucket_id in ('attendance-photos', 'leave-attachments', 'avatars')
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (select public.is_admin())
  )
);

comment on function public.is_admin() is 'RLS-safe admin check based on active profiles.';
comment on function public.operational_date() is 'Server-derived attendance date in the configured timezone.';
