-- 20261017000200_profiles_private_columns.sql
-- Step 2 of 2. profiles_select_public lets any signed-in user read every
-- profile row (avatars, roles and verification badges are shown across the
-- app), and the table-wide SELECT grant exposed every column with it:
-- email, phone and Stripe billing ids/subscription state of all users.
--
-- Same fix as facility_profiles (20261015000200): keep the row policy, but
-- only grant SELECT on the columns other users legitimately see. The owner
-- reads their full row through my_profile() (20261017000100); admin pages,
-- webhooks and notification code use the service role (unaffected).
-- Writes are unchanged: INSERT/UPDATE privileges are separate from SELECT.
--
-- stripe_connect_id stays readable: an acct_ id is useless without Sanus's
-- secret key, and payout pages read it for the owner.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id,
  role,
  avatar_url,
  is_active,
  is_verified,
  stripe_connect_id,
  stripe_connect_onboarded,
  signup_path,
  classification_status,
  created_at,
  updated_at
) ON public.profiles TO anon, authenticated;
