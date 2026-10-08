begin;
select plan(45);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'institutions', 'institutions exists');
select has_table('public', 'internships', 'internships exists');
select has_table('public', 'attendance_records', 'attendance_records exists');
select has_table('public', 'journals', 'journals exists');
select has_table('public', 'leave_requests', 'leave_requests exists');
select has_table('public', 'attendance_settings', 'attendance_settings exists');
select has_table('public', 'audit_logs', 'audit_logs exists');

select col_is_pk('public', 'profiles', 'id', 'profiles id is primary key');
select col_is_fk('public', 'profiles', 'id', 'profiles id references auth user');
select col_is_fk('public', 'attendance_records', 'participant_id', 'attendance participant FK exists');
select col_is_fk('public', 'attendance_records', 'internship_id', 'attendance internship FK exists');
select col_is_fk('public', 'attendance_records', 'leave_request_id', 'attendance leave provenance FK exists');

select has_index('public', 'attendance_records', 'attendance_unique_participant_date', 'attendance duplicate protection exists');
select has_index('public', 'journals', 'journals_unique_participant_date', 'journal duplicate protection exists');
select has_index('public', 'internships', 'internships_one_active_per_participant', 'one active internship protection exists');

select is(
  round(public.haversine_distance_meters(0, 0, 0, 0)::numeric, 2),
  0.00::numeric,
  'haversine returns zero for identical points'
);
select ok(
  public.haversine_distance_meters(0, 0, 0, 0.001) between 110 and 112,
  'haversine returns expected distance'
);

select policies_are(
  'public', 'attendance_records',
  array['attendance_select_own_or_admin'],
  'attendance has only select RLS policy'
);
select policies_are(
  'public', 'audit_logs',
  array['audit_logs_admin_select'],
  'audit log is admin read-only'
);

select isnt(
  (select count(*) from storage.buckets where public),
  3::bigint,
  'storage buckets are not all public'
);
select is(
  (select count(*) from storage.buckets where id in ('attendance-photos', 'leave-attachments', 'avatars') and not public),
  3::bigint,
  'all application buckets are private'
);

select function_returns('public', 'perform_check_in', array['text', 'double precision', 'double precision', 'double precision'], 'jsonb');
select function_returns('public', 'perform_check_out', array['text', 'text'], 'jsonb');

select function_returns('public', 'operational_context', array[]::text[], 'jsonb');
select ok(
  (select (public.operational_context() ?& array['serverNow', 'operationalDate', 'timezone', 'isWorkDay', 'checkInTime', 'checkOutTime', 'lateToleranceMinutes'])),
  'operational_context exposes the full server clock contract'
);
select is(
  (select public.operational_context() ->> 'timezone'),
  (select timezone from public.attendance_settings where singleton_key limit 1),
  'operational_context timezone follows settings'
);
select is(
  (select (public.operational_context() ->> 'operationalDate')::date),
  (select public.operational_date()),
  'operational_context date matches operational_date'
);

select has_table('public', 'holiday_calendar', 'holiday_calendar exists');
select has_column('public', 'attendance_records', 'early_checkout_minutes', 'early checkout column exists');
select has_column('public', 'attendance_records', 'work_duration_minutes', 'work duration column exists');
select has_column('public', 'attendance_records', 'policy_snapshot', 'policy snapshot column exists');
select function_returns('public', 'materialize_absences', array['date'], 'jsonb');
select function_returns('public', 'admin_create_attendance', array['uuid', 'date', 'attendance_status', 'text', 'timestamptz', 'timestamptz', 'text', 'double precision', 'double precision', 'double precision', 'uuid'], 'jsonb');

select has_table('public', 'operation_log', 'operation_log exists');
select has_column('public', 'attendance_records', 'check_in_photo_hash', 'photo hash column exists');
select has_column('public', 'attendance_records', 'check_in_photo_size', 'photo size column exists');
select has_column('public', 'leave_requests', 'client_operation_id', 'leave operation id column exists');
select function_returns('public', 'save_journal', array['uuid', 'text'], 'jsonb');
select function_returns('public', 'submit_leave_request', array['uuid', 'uuid', 'leave_request_type', 'date', 'date', 'text', 'text'], 'jsonb');
select function_returns('public', 'claim_operation', array['uuid', 'text'], 'jsonb');
select function_returns('public', 'perform_check_in', array['text', 'double precision', 'double precision', 'double precision', 'uuid', 'text', 'integer'], 'jsonb');

select has_table('public', 'journal_revisions', 'journal_revisions exists');
select has_column('public', 'journal_revisions', 'revision_no', 'revision number column exists');
select has_index('public', 'journal_revisions', 'journal_revisions_unique_journal_revision', 'journal revision uniqueness exists');

select * from finish();
rollback;
