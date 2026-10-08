-- Fase 2: single server-time source for mobile + admin.
-- operational_context() returns the authoritative clock, operational date,
-- timezone, work-day flag, and schedule in one round trip so clients never
-- derive business dates from the device clock.
-- NOTE: key casing was corrected to camelCase in 20260924131000.

create or replace function public.operational_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'serverNow', now(),
    'operationalDate', (now() at time zone coalesce(s.timezone, 'Asia/Jakarta'))::date,
    'timezone', coalesce(s.timezone, 'Asia/Jakarta'),
    'isWorkDay', extract(isodow from (now() at time zone coalesce(s.timezone, 'Asia/Jakarta')))::int = any (coalesce(s.work_days, array[1,2,3,4,5])),
    'checkInTime', s.check_in_time,
    'checkOutTime', s.check_out_time,
    'lateToleranceMinutes', s.late_tolerance_minutes
  )
  from public.attendance_settings s
  where s.singleton_key
  limit 1;
$$;

revoke all on function public.operational_context() from public;
grant execute on function public.operational_context() to authenticated;
