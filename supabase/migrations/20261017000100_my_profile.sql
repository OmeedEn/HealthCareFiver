-- 20261017000100_my_profile.sql
-- Step 1 of 2 (see 20261017000200): a way for a signed-in user to read their
-- own full profiles row once email, phone and billing columns are no longer
-- readable from the table. Applied before the app code that calls it.

-- The caller's own profile row, every column. SECURITY DEFINER so it
-- bypasses the column grants; the WHERE clause is the whole guard.
CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;
