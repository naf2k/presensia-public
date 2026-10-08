-- Fase 6: remove UAT participant ([UJI] Coba) and all drill residue so the
-- production project is clean for operational use.
-- Storage objects were deleted via the Storage API as the owning participant
-- before this migration (SQL cannot touch storage.objects).
-- Idempotent: safe to re-run.

-- Audit rows that only describe UAT entities (keep real admin actions).
delete from public.audit_logs
where actor_id = '569eafb9-ebe1-45af-a307-cf437a8930b2'
   or entity_id in (
     select id::text from public.attendance_records
     where participant_id = '569eafb9-ebe1-45af-a307-cf437a8930b2'
     union
     select id::text from public.journals
     where participant_id = '569eafb9-ebe1-45af-a307-cf437a8930b2'
     union
     select id::text from public.leave_requests
     where participant_id = '569eafb9-ebe1-45af-a307-cf437a8930b2'
   );

delete from public.attendance_records
where participant_id = '569eafb9-ebe1-45af-a307-cf437a8930b2';

-- journal_revisions cascade from journals.
delete from public.journals
where participant_id = '569eafb9-ebe1-45af-a307-cf437a8930b2';

delete from public.leave_requests
where participant_id = '569eafb9-ebe1-45af-a307-cf437a8930b2';

delete from public.internships
where participant_id = '569eafb9-ebe1-45af-a307-cf437a8930b2';

-- operation_log is retry bookkeeping (prunable after 90 days per retention
-- policy); drop UAT rows so the profile FK clears.
delete from public.operation_log
where user_id = '569eafb9-ebe1-45af-a307-cf437a8930b2';

delete from public.profiles
where id = '569eafb9-ebe1-45af-a307-cf437a8930b2';

delete from public.institutions
where id = '5748b006-4c7d-4f05-a6d9-bc5a5e64a5ae';

delete from auth.identities
where user_id = '569eafb9-ebe1-45af-a307-cf437a8930b2';

delete from auth.users
where id = '569eafb9-ebe1-45af-a307-cf437a8930b2';
