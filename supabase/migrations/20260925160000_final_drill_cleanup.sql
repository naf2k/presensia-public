-- Final import-drill cleanup: all test accounts from every drill round
-- (.qb, multi, zzz, cnt, big, .qn, single/quix probes) + temp institutions.
-- Real data (2 admins, Muhammad Nafi, SMK Telkom Bandung) untouched.
-- Idempotent: safe to re-run.

delete from public.audit_logs
where entity_id in (
  select id::text from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com')
);

delete from public.attendance_records
where participant_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com')
);

delete from public.journals
where participant_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com')
);

delete from public.leave_requests
where participant_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com')
);

delete from public.internships
where participant_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com')
);

delete from public.operation_log
where user_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com')
);

delete from auth.identities
where user_id in (
  select id from public.profiles
  where email like '%.qb@mail.com'
     or email like 'multi.%@mail.com'
     or email like 'zzz.%@mail.com'
     or email like 'cnt%.t@mail.com'
     or email like 'big%.t@mail.com'
     or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
     or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com')
);

delete from public.profiles
where email like '%.qb@mail.com'
   or email like 'multi.%@mail.com'
   or email like 'zzz.%@mail.com'
   or email like 'cnt%.t@mail.com'
   or email like 'big%.t@mail.com'
   or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
   or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com');

delete from auth.users
where (email like '%.qb@mail.com'
   or email like 'multi.%@mail.com'
   or email like 'zzz.%@mail.com'
   or email like 'cnt%.t@mail.com'
   or email like 'big%.t@mail.com'
   or email like '%.qn@mail.com'
     or email = 'single.ui@mail.com'
     or email like '%.qm@mail.com'
   or email in ('single.probe.88@gmail.com', 'quix.tester.88@gmail.com', 'single.ui@mail.com'))
  and id not in (select id from public.profiles);

-- Temp institutions (never real ones like SMK Telkom Bandung).
delete from public.institutions
where lower(name) like '[uji]%';
