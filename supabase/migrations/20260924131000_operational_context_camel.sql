-- Fase 2 fix: camelCase keys to match the mobile/admin client contract.
-- (The initial version exposed snake_case keys.)

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
