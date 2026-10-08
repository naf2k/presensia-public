create or replace function public.provision_participant(
  p_actor_id uuid,
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_institution_id uuid,
  p_participant_type public.participant_type,
  p_student_number text,
  p_major text,
  p_start_date date,
  p_end_date date,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_internship public.internships%rowtype;
  v_institution public.institutions%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin' and is_active
  ) then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  select * into v_institution from public.institutions
  where id = p_institution_id and is_active;
  if not found then
    raise exception using errcode = 'P0001', message = 'INSTITUTION_NOT_FOUND';
  end if;
  if (p_participant_type = 'SMK_PKL' and v_institution.institution_type <> 'SMK')
    or (p_participant_type = 'UNIVERSITY_INTERN' and v_institution.institution_type <> 'UNIVERSITY') then
    raise exception using errcode = 'P0001', message = 'INSTITUTION_TYPE_MISMATCH';
  end if;

  insert into public.profiles (id, role, full_name, email, phone, is_active)
  values (p_user_id, 'participant', trim(p_full_name), lower(trim(p_email)), nullif(trim(p_phone), ''), p_is_active)
  returning * into v_profile;

  insert into public.internships (
    participant_id, institution_id, participant_type, student_number,
    major, start_date, end_date, is_active
  ) values (
    p_user_id, p_institution_id, p_participant_type, trim(p_student_number),
    trim(p_major), p_start_date, p_end_date, p_is_active
  ) returning * into v_internship;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, after_data
  ) values (
    p_actor_id, 'PARTICIPANT_CREATED', 'profile', p_user_id::text,
    jsonb_build_object('profile', to_jsonb(v_profile), 'internship', to_jsonb(v_internship))
  );

  return jsonb_build_object('profile', to_jsonb(v_profile), 'internship', to_jsonb(v_internship));
end;
$$;

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
  where participant_id = p_participant_id and is_active for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INTERNSHIP_INACTIVE';
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

  v_action := case
    when v_profile_before.is_active and not p_is_active then 'PARTICIPANT_DEACTIVATED'
    when not v_profile_before.is_active and p_is_active then 'PARTICIPANT_REACTIVATED'
    else 'PARTICIPANT_UPDATED'
  end;
  if v_action in ('PARTICIPANT_DEACTIVATED', 'PARTICIPANT_REACTIVATED')
    and char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

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

revoke all on function public.provision_participant(uuid, uuid, text, text, text, uuid, public.participant_type, text, text, date, date, boolean) from public, anon, authenticated;
grant execute on function public.provision_participant(uuid, uuid, text, text, text, uuid, public.participant_type, text, text, date, date, boolean) to service_role;

revoke all on function public.admin_update_participant(uuid, text, text, text, boolean, uuid, public.participant_type, text, text, date, date, text) from public;
grant execute on function public.admin_update_participant(uuid, text, text, text, boolean, uuid, public.participant_type, text, text, date, date, text) to authenticated;
