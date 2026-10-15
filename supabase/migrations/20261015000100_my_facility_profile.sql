-- 20261015000100_my_facility_profile.sql
-- Step 1 of 2 (see 20261015000200): a way for an organization to read its
-- own full facility_profiles row once private columns are no longer
-- readable from the table. Applied before the app code that calls it.

-- The caller's own organization row, every column. SECURITY DEFINER so it
-- bypasses the column grants above; the WHERE clause is the whole guard.
CREATE OR REPLACE FUNCTION public.my_facility_profile()
RETURNS SETOF public.facility_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.facility_profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_facility_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_facility_profile() TO authenticated;
