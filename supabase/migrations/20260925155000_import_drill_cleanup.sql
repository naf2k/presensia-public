-- Cleanup import-drill accounts (bulk verification) + any earlier probe rows.
-- Matches test-only addresses; real data untouched. Idempotent.

delete from public.audit_logs
where entity_id in (
  select id::text from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com')
);

delete from public.attendance_records
where participant_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com')
);

delete from public.journals
where participant_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com')
);

delete from public.leave_requests
where participant_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com')
);

delete from public.internships
where participant_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com')
);

delete from public.operation_log
where user_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com')
);

delete from auth.identities
where user_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com')
);

delete from public.profiles
where email like '%.qb@mail.com'
   or email like 'multi.%@mail.com'
   or email like 'zzz.%@mail.com'
   or email like 'cnt%.t@mail.com'
   or email like 'big%.t@mail.com'
   or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com');

delete from auth.users
where (email like '%.qb@mail.com'
   or email like 'multi.%@mail.com'
   or email like 'zzz.%@mail.com'
   or email like 'cnt%.t@mail.com'
   or email like 'big%.t@mail.com'
   or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com'))
  and id not in (select id from public.profiles);
