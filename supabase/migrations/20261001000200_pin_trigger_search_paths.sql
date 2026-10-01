-- Make bookkeeping triggers work when a delete cascades from auth.users.
--
-- Deleting a user through the Auth admin API (delete-account, admin deletes)
-- runs the cascade as supabase_auth_admin. Its search_path doesn't include
-- public and it has no privileges on app tables, so these triggers failed with
-- `relation "jobs" does not exist` / `permission denied for table jobs` and
-- aborted the whole delete for anyone with job applications or messages.
--
-- Pin search_path (as every other trigger function here does) and run the two
-- that write to other tables as their owner, like update_reviewee_rating. They
-- only adjust counters / last-message fields, so SECURITY DEFINER is safe.

ALTER FUNCTION public.update_job_applicant_count() SET search_path = public;
ALTER FUNCTION public.update_job_applicant_count() SECURITY DEFINER;

ALTER FUNCTION public.update_conversation_last_message() SET search_path = public;
ALTER FUNCTION public.update_conversation_last_message() SECURITY DEFINER;

ALTER FUNCTION public.generate_invoice_number() SET search_path = public;
