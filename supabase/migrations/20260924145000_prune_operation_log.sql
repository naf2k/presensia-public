-- Fase 6: automatic pruning of operation_log (retry bookkeeping only, not
-- evidence) older than 90 days, per docs/ops/retention-policy.md.
-- Mirrors the materialize-absences pg_cron precedent: guarded schedule,
-- SECURITY DEFINER worker, admin-only manual runs.

create or replace function public.prune_operation_log()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pruned integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  delete from public.operation_log
  where created_at < now() - interval '90 days';
  get diagnostics v_pruned = row_count;

  return jsonb_build_object('pruned', v_pruned);
end;
$$;

revoke all on function public.prune_operation_log() from public;
grant execute on function public.prune_operation_log() to authenticated;

comment on function public.prune_operation_log()
  is 'Deletes operation_log rows older than 90 days (retry bookkeeping, not evidence).';

-- Daily prune at 10:15 UTC = 17:15 WIB (after the absence job).
do $cron_block$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'prune-operation-log-daily') then
      perform cron.schedule(
        'prune-operation-log-daily',
        '15 10 * * *',
        $$select public.prune_operation_log()$$
      );
    end if;
  end if;
end;
$cron_block$;
