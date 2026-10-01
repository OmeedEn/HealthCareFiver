-- 20260930000015_handle_new_user_phone_and_google_names.sql
-- handle_new_user(): copy of 20260930000005 with two additions for
-- professional onboarding v2:
--   * profiles.phone from signup metadata 'phone' (step 1 collects it).
--   * Name fallback for OAuth (Google) signups, which send given_name /
--     family_name and/or full_name / name instead of first_name / last_name.
-- Everything else (SECURITY DEFINER + pinned search_path, admin downgrade,
-- safe enum casts, per-role rows) is unchanged.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _phone TEXT;
  _full_name TEXT;
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

  _first_name := NULLIF(NEW.raw_user_meta_data->>'first_name', '');
  _last_name := NULLIF(NEW.raw_user_meta_data->>'last_name', '');

  -- OAuth (Google) fallback: given_name / family_name, else split
  -- full_name / name on the first whitespace run.
  IF _first_name IS NULL THEN
    _first_name := NULLIF(LEFT(BTRIM(COALESCE(NEW.raw_user_meta_data->>'given_name', '')), 100), '');
  END IF;
  IF _last_name IS NULL THEN
    _last_name := NULLIF(LEFT(BTRIM(COALESCE(NEW.raw_user_meta_data->>'family_name', '')), 100), '');
  END IF;
  IF _first_name IS NULL OR _last_name IS NULL THEN
    _full_name := regexp_replace(
      BTRIM(COALESCE(
        NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
        ''
      )),
      '\s+', ' ', 'g'
    );
    IF _full_name <> '' THEN
      IF _first_name IS NULL THEN
        _first_name := NULLIF(LEFT(split_part(_full_name, ' ', 1), 100), '');
      END IF;
      IF _last_name IS NULL AND position(' ' IN _full_name) > 0 THEN
        _last_name := NULLIF(LEFT(substr(_full_name, position(' ' IN _full_name) + 1), 100), '');
      END IF;
    END IF;
  END IF;

  _first_name := COALESCE(_first_name, '');
  _last_name := COALESCE(_last_name, '');

  -- Phone (user-controlled metadata): keep only plausible values, never let
  -- a bad value abort signup.
  _phone := BTRIM(COALESCE(NEW.raw_user_meta_data->>'phone', ''));
  IF _phone !~ '^\+?[0-9 ().-]{7,32}$' THEN
    _phone := NULL;
  END IF;
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

  INSERT INTO profiles (id, role, email, phone)
  VALUES (NEW.id, _role, NEW.email, _phone);

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
