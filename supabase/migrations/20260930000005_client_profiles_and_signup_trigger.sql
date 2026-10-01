-- client_profiles + handle_new_user() support for the 'client' role.
--
-- * Clients (consumers seeking care) get a client_profiles row with the
--   interests + location they chose during signup, and NO contractor_profiles
--   row (so they never hit the provider verification queue or paywall).
-- * Contractors: persist the professional_category picked at signup
--   (column added in 20260930000002).
-- * Facilities: persist contact_name / city / state / zip_code, which the
--   signup form already collected but the trigger discarded.

-- ============================================================
-- client_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  interests TEXT[] NOT NULL DEFAULT '{}',
  city TEXT,
  state TEXT CHECK (state IS NULL OR state ~ '^[A-Z]{2}$'),
  zip_code TEXT CHECK (zip_code IS NULL OR zip_code ~ '^\d{5}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS client_profiles_updated_at ON client_profiles;
CREATE TRIGGER client_profiles_updated_at
  BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- Consumer data is private: unlike contractor/facility profiles there is no
-- public select policy. Rows are created only by handle_new_user(), so there
-- is no insert policy either.
DROP POLICY IF EXISTS "client_profiles_select_own" ON client_profiles;
CREATE POLICY "client_profiles_select_own"
  ON client_profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "client_profiles_update_own" ON client_profiles;
CREATE POLICY "client_profiles_update_own"
  ON client_profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "client_profiles_select_admin" ON client_profiles;
CREATE POLICY "client_profiles_select_admin"
  ON client_profiles FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================
-- handle_new_user()
-- Based on 20260809000001_fix_handle_new_user_search_path.sql; keeps
-- SECURITY DEFINER + pinned search_path, the admin downgrade and the safe
-- enum casts.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role := 'contractor';
  _contractor_type contractor_type := 'other';
  _facility_type facility_type := 'other';
  _first_name TEXT;
  _last_name TEXT;
  _facility_name TEXT;
  _city TEXT;
  _state TEXT;
  _zip_code TEXT;
  _interests TEXT[] := '{}';
  _professional_category TEXT;
  _raw_role TEXT := NULLIF(NEW.raw_user_meta_data->>'role', '');
  _raw_contractor_type TEXT := NULLIF(NEW.raw_user_meta_data->>'contractor_type', '');
  _raw_facility_type TEXT := NULLIF(NEW.raw_user_meta_data->>'facility_type', '');
BEGIN
  IF _raw_role IS NOT NULL THEN
    BEGIN
      _role := _raw_role::user_role;
    EXCEPTION WHEN invalid_text_representation THEN
      _role := 'contractor';
    END;
  END IF;

  -- admin must be granted server-side; never accept it from public signup.
  IF _role = 'admin' THEN
    _role := 'contractor';
  END IF;

  IF _raw_contractor_type IS NOT NULL THEN
    BEGIN
      _contractor_type := _raw_contractor_type::contractor_type;
    EXCEPTION WHEN invalid_text_representation THEN
      _contractor_type := 'other';
    END;
  END IF;

  IF _raw_facility_type IS NOT NULL THEN
    BEGIN
      _facility_type := _raw_facility_type::facility_type;
    EXCEPTION WHEN invalid_text_representation THEN
      _facility_type := 'other';
    END;
  END IF;

  _first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  _last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  _facility_name := COALESCE(NEW.raw_user_meta_data->>'facility_name', '');

  -- Location. Metadata is user-controlled (auth.signUp can be called directly
  -- with the anon key), so normalise invalid values to NULL rather than let
  -- a CHECK violation abort the whole signup.
  _city := NULLIF(LEFT(BTRIM(COALESCE(NEW.raw_user_meta_data->>'city', '')), 100), '');
  _state := UPPER(BTRIM(COALESCE(NEW.raw_user_meta_data->>'state', '')));
  IF _state !~ '^[A-Z]{2}$' THEN
    _state := NULL;
  END IF;
  _zip_code := BTRIM(COALESCE(NEW.raw_user_meta_data->>'zip_code', ''));
  IF _zip_code !~ '^\d{5}$' THEN
    _zip_code := NULL;
  END IF;

  INSERT INTO profiles (id, role, email)
  VALUES (NEW.id, _role, NEW.email);

  IF _role = 'contractor' THEN
    _professional_category := NEW.raw_user_meta_data->>'professional_category';
    IF _professional_category IS NULL
       OR _professional_category NOT IN ('clinical', 'allied', 'consultant', 'educator') THEN
      _professional_category := NULL;
    END IF;

    INSERT INTO contractor_profiles (
      id, first_name, last_name, contractor_type, professional_category
    )
    VALUES (
      NEW.id, _first_name, _last_name, _contractor_type, _professional_category
    );
  ELSIF _role = 'facility' OR _role = 'staffing_agency' THEN
    INSERT INTO facility_profiles (
      id, facility_name, facility_type, contact_name, city, state, zip_code
    )
    VALUES (
      NEW.id,
      _facility_name,
      _facility_type,
      NULLIF(LEFT(BTRIM(COALESCE(NEW.raw_user_meta_data->>'contact_name', '')), 200), ''),
      _city,
      _state,
      _zip_code
    );
  ELSIF _role = 'client' THEN
    IF jsonb_typeof(NEW.raw_user_meta_data->'interests') = 'array' THEN
      SELECT COALESCE(array_agg(DISTINCT LEFT(s.v, 50)), '{}')
        INTO _interests
        FROM (
          SELECT t.e #>> '{}' AS v
            FROM jsonb_array_elements(NEW.raw_user_meta_data->'interests') AS t(e)
           WHERE jsonb_typeof(t.e) = 'string'
           LIMIT 20
        ) s
       WHERE s.v <> '';
    END IF;

    INSERT INTO client_profiles (
      id, first_name, last_name, interests, city, state, zip_code
    )
    VALUES (
      NEW.id,
      LEFT(_first_name, 100),
      LEFT(_last_name, 100),
      _interests,
      _city,
      _state,
      _zip_code
    );
  END IF;

  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
