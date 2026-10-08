revoke insert, update on public.journals from authenticated;
grant insert (
  participant_id, internship_id, attendance_id, journal_date, content
) on public.journals to authenticated;
grant update (content) on public.journals to authenticated;

revoke insert on public.leave_requests from authenticated;
grant insert (
  participant_id, internship_id, type, start_date, end_date, reason, attachment_path
) on public.leave_requests to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_leave_request_insert() from public, anon, authenticated;
revoke all on function public.validate_internship_type() from public, anon, authenticated;
