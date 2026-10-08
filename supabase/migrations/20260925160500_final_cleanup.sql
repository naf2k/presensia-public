-- Final production cleanup: hapus akun Muhammad Nafi + SMK Telkom Bandung
-- (dikonfirmasi owner: bukan data asli). Idempotent.
-- Avatar yatim <24 jam dibersihkan otomatis oleh cleanup-orphans besok.

delete from public.audit_logs
where entity_id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from public.attendance_records
where participant_id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from public.journals
where participant_id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from public.leave_requests
where participant_id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from public.internships
where participant_id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from public.operation_log
where user_id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from auth.identities
where user_id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from public.profiles
where id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from auth.users
where id = '4d8b12cc-f7dd-4f24-8ecd-5702a981b79a';

delete from public.institutions
where id = '078b90a1-0ad5-4a98-bd90-4df8373cf70e';
