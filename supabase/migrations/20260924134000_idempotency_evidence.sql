-- Fase 4: idempotent mutations + evidence integrity.
-- 1. operation_log with claim/complete protocol for safe retries.
-- 2. Photo hash/size columns with byte-reuse protection.
-- 3. client_operation_id on leave_requests for reconcile-after-ambiguity.
-- 4. save_journal / submit_leave_request RPCs replace direct client writes.
-- 5. Admin mutations accept optional operation ids.

-- ---------------------------------------------------------------------------
-- Operation log (server-side only; never exposed to clients)
-- ---------------------------------------------------------------------------

create table if not exists public.operation_log (
  operation_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null,
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS', 'SUCCEEDED', 'FAILED')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operation_log enable row level security;

drop policy if exists operation_log_admin_select on public.operation_log;
create policy operation_log_admin_select
on public.operation_log for select to authenticated
using ((select public.is_admin()));

grant usage on schema public to authenticated;
grant select on public.operation_log to authenticated;
revoke insert, update, delete on public.operation_log from anon, authenticated;

-- Claim a key before doing work. Returns a stored SUCCEEDED response when the
-- same key already completed, so retries never duplicate side effects.
create or replace function public.claim_operation(
  p_operation_id uuid,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.operation_log%rowtype;
begin
  if p_operation_id is null then
    return null;
  end if;
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('op:' || p_operation_id::text, 0)
  );

  select * into v_row from public.operation_log where operation_id = p_operation_id;
  if found then
    if v_row.user_id <> auth.uid() then
      raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
    end if;
    if v_row.operation <> p_operation then
      raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
    end if;
    if v_row.status = 'SUCCEEDED' then
      return v_row.response;
    end if;
    if v_row.status = 'IN_PROGRESS' and v_row.updated_at > now() - interval '10 minutes' then
      raise exception using errcode = 'P0001', message = 'OPERATION_IN_PROGRESS';
    end if;
    update public.operation_log
    set status = 'IN_PROGRESS', updated_at = now()
    where operation_id = p_operation_id;
    return null;
  end if;

  insert into public.operation_log (operation_id, user_id, operation)
  values (p_operation_id, auth.uid(), p_operation);
  return null;
end;
$$;

create or replace function public.complete_operation(
  p_operation_id uuid,
  p_response jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.operation_log
  set status = 'SUCCEEDED', response = p_response, updated_at = now()
  where operation_id = p_operation_id and user_id = auth.uid();
$$;

revoke all on function public.claim_operation(uuid, text) from public;
revoke all on function public.complete_operation(uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Evidence hash/size + leave client operation id
-- ---------------------------------------------------------------------------

alter table public.attendance_records
  add column if not exists check_in_photo_hash text,
  add column if not exists check_in_photo_size integer
    check (check_in_photo_size is null or check_in_photo_size > 0);

drop index if exists attendance_check_in_photo_hash_unique;
create unique index attendance_check_in_photo_hash_unique
  on public.attendance_records (check_in_photo_hash)
  where check_in_photo_hash is not null;

alter table public.leave_requests
  add column if not exists client_operation_id uuid unique;

-- Direct client writes move behind RPCs; service role and tests are unaffected.
revoke insert, update on public.journals from authenticated;
revoke insert on public.leave_requests from authenticated;

-- ---------------------------------------------------------------------------
-- Atomic journal save (replaces select-then-insert from the client)
-- ---------------------------------------------------------------------------

create or replace function public.save_journal(
  p_operation_id uuid,
  p_content text
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
  v_date date;
  v_content text := trim(coalesce(p_content, ''));
  v_replay jsonb;
  v_journal public.journals%rowtype;
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
  v_date := (now() at time zone v_settings.timezone)::date;

  if v_content = '' then
    raise exception using errcode = 'P0001', message = 'EMPTY_JOURNAL';
  end if;
  if char_length(v_content) > v_settings.max_journal_length then
    raise exception using errcode = 'P0001', message = 'JOURNAL_TOO_LONG';
  end if;

  select * into v_internship
  from public.internships
  where participant_id = auth.uid()
    and is_active
    and v_date between start_date and end_date;
  if not found then
    raise exception using errcode = 'P0001', message = 'INTERNSHIP_INACTIVE';
  end if;

  v_replay := public.claim_operation(p_operation_id, 'JOURNAL_SAVE');
  if v_replay is not null then
    return v_replay;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':journal:' || v_date::text, 0)
  );

  insert into public.journals (
    participant_id, internship_id, journal_date, content
  ) values (
    auth.uid(), v_internship.id, v_date, v_content
  )
  on conflict (participant_id, journal_date) do update
    set content = excluded.content,
        internship_id = excluded.internship_id
  returning * into v_journal;

  perform public.complete_operation(p_operation_id, to_jsonb(v_journal));
  return to_jsonb(v_journal);
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'JOURNAL_CONFLICT';
end;
$$;

-- ---------------------------------------------------------------------------
-- Leave submission with reconcile-after-ambiguity
-- ---------------------------------------------------------------------------

create or replace function public.submit_leave_request(
  p_operation_id uuid,
  p_internship_id uuid,
  p_type public.leave_request_type,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_attachment_path text default null
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
  v_reason text := trim(coalesce(p_reason, ''));
  v_attachment text := nullif(trim(coalesce(p_attachment_path, '')), '');
  v_replay jsonb;
  v_leave public.leave_requests%rowtype;
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

  if p_type is null or p_start_date is null or p_end_date is null
    or p_end_date < p_start_date then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_REASON';
  end if;

  select * into v_internship
  from public.internships
  where id = p_internship_id
    and participant_id = auth.uid()
    and is_active
    and p_start_date >= start_date
    and p_end_date <= end_date;
  if not found then
    raise exception using errcode = 'P0001', message = 'INTERNSHIP_INACTIVE';
  end if;

  if v_attachment is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'leave-attachments'
      and o.name = v_attachment
      and (storage.foldername(o.name))[1] = auth.uid()::text
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_ATTACHMENT';
  end if;

  select * into v_settings from public.attendance_settings where singleton_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;

  v_replay := public.claim_operation(p_operation_id, 'LEAVE_SUBMIT');
  if v_replay is not null then
    return v_replay;
  end if;

  begin
    insert into public.leave_requests (
      participant_id, internship_id, type, start_date, end_date,
      reason, attachment_path, status, client_operation_id
    ) values (
      auth.uid(), v_internship.id, p_type, p_start_date, p_end_date,
      v_reason, v_attachment, 'PENDING', p_operation_id
    ) returning * into v_leave;
  exception
    when unique_violation then
      -- Same operation retried after an ambiguous failure: reconcile.
      select * into v_leave from public.leave_requests
      where client_operation_id = p_operation_id and participant_id = auth.uid();
      if not found then
        raise exception using errcode = 'P0001', message = 'JOURNAL_CONFLICT';
      end if;
  end;

  perform public.complete_operation(p_operation_id, to_jsonb(v_leave));
  return to_jsonb(v_leave);
end;
$$;

revoke all on function public.save_journal(uuid, text) from public;
revoke all on function public.submit_leave_request(uuid, uuid, public.leave_request_type, date, date, text, text) from public;
grant execute on function public.save_journal(uuid, text) to authenticated;
grant execute on function public.submit_leave_request(uuid, uuid, public.leave_request_type, date, date, text, text) to authenticated;
