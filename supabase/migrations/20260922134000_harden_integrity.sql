alter table public.attendance_settings
  add constraint attendance_settings_location_name_required
  check (char_length(trim(location_name)) between 2 and 150);

create or replace function public.validate_internship_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.institution_type;
begin
  select institution_type into v_type
  from public.institutions where id = new.institution_id;
  if (new.participant_type = 'SMK_PKL' and v_type <> 'SMK')
    or (new.participant_type = 'UNIVERSITY_INTERN' and v_type <> 'UNIVERSITY') then
    raise exception using errcode = 'P0001', message = 'INSTITUTION_TYPE_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger internships_validate_type
before insert or update of institution_id, participant_type on public.internships
for each row execute function public.validate_internship_type();

drop policy journals_participant_insert on public.journals;
drop policy journals_participant_update on public.journals;

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
  and (
    attendance_id is null
    or exists (
      select 1 from public.attendance_records a
      where a.id = attendance_id
        and a.participant_id = auth.uid()
        and a.attendance_date = journal_date
    )
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
  and (
    attendance_id is null
    or exists (
      select 1 from public.attendance_records a
      where a.id = attendance_id
        and a.participant_id = auth.uid()
        and a.attendance_date = journal_date
    )
  )
  and char_length(content) <= coalesce(
    (select max_journal_length from public.attendance_settings where singleton_key),
    500
  )
);

create or replace function public.admin_update_participant(
  p_participant_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_is_active boolean,
  p_institution_id uuid,
  p_participant_type public.participant_type,
  p_student_number text,
  p_major text,
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_before public.profiles%rowtype;
  v_profile_after public.profiles%rowtype;
  v_internship_before public.internships%rowtype;
  v_internship_after public.internships%rowtype;
  v_action text;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  select * into v_profile_before from public.profiles
  where id = p_participant_id and role = 'participant' for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PARTICIPANT_NOT_FOUND';
  end if;
  select * into v_internship_before from public.internships
  where participant_id = p_participant_id
  order by is_active desc, created_at desc
  limit 1 for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INTERNSHIP_NOT_FOUND';
  end if;

  v_action := case
    when v_profile_before.is_active and not p_is_active then 'PARTICIPANT_DEACTIVATED'
    when not v_profile_before.is_active and p_is_active then 'PARTICIPANT_REACTIVATED'
    else 'PARTICIPANT_UPDATED'
  end;
  if v_action in ('PARTICIPANT_DEACTIVATED', 'PARTICIPANT_REACTIVATED')
    and char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  update public.profiles set
    email = lower(trim(p_email)),
    full_name = trim(p_full_name),
    phone = nullif(trim(p_phone), ''),
    is_active = p_is_active
  where id = p_participant_id
  returning * into v_profile_after;

  update public.internships set
    institution_id = p_institution_id,
    participant_type = p_participant_type,
    student_number = trim(p_student_number),
    major = trim(p_major),
    start_date = p_start_date,
    end_date = p_end_date,
    is_active = p_is_active
  where id = v_internship_before.id
  returning * into v_internship_after;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, reason
  ) values (
    auth.uid(), v_action, 'profile', p_participant_id::text,
    jsonb_build_object('profile', to_jsonb(v_profile_before), 'internship', to_jsonb(v_internship_before)),
    jsonb_build_object('profile', to_jsonb(v_profile_after), 'internship', to_jsonb(v_internship_after)),
    nullif(trim(p_reason), '')
  );

  return jsonb_build_object('profile', to_jsonb(v_profile_after), 'internship', to_jsonb(v_internship_after));
end;
$$;
