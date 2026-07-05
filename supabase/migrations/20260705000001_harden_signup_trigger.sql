-- Harden handle_new_user against invalid enum metadata at signup.
--
-- The previous definition coerced enums with
--   COALESCE((raw_user_meta_data->>'contractor_type')::contractor_type, 'other')
-- but the cast is evaluated BEFORE COALESCE, so it only guards NULL — an
-- invalid (non-null) value raises `invalid_text_representation`, which aborts
-- the entire auth.users INSERT. The user then sees an opaque signup failure
-- and the API leaks the raw Postgres error.
--
-- The public anon key can call auth.signUp directly with arbitrary
-- raw_user_meta_data, so the DB trigger — not the API's Zod check — is the real
-- boundary. Coerce every enum defensively: unknown values fall back to a safe
-- default instead of failing the signup. The admin-role clamp is preserved.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role := 'contractor';
  _contractor_type contractor_type := 'other';
  _facility_type facility_type := 'other';
  _first_name TEXT;
  _last_name TEXT;
  _facility_name TEXT;
  _raw_role TEXT := NULLIF(NEW.raw_user_meta_data->>'role', '');
  _raw_contractor_type TEXT := NULLIF(NEW.raw_user_meta_data->>'contractor_type', '');
  _raw_facility_type TEXT := NULLIF(NEW.raw_user_meta_data->>'facility_type', '');
BEGIN
  -- Safe enum coercion: an invalid value falls back to the default rather than
  -- aborting the whole auth.users insert.
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

  -- Create base profile
  INSERT INTO profiles (id, role, email)
  VALUES (NEW.id, _role, NEW.email);

  -- Create role-specific profile
  IF _role = 'contractor' THEN
    INSERT INTO contractor_profiles (id, first_name, last_name, contractor_type)
    VALUES (NEW.id, _first_name, _last_name, _contractor_type);
  ELSIF _role = 'facility' OR _role = 'staffing_agency' THEN
    INSERT INTO facility_profiles (id, facility_name, facility_type)
    VALUES (NEW.id, _facility_name, _facility_type);
  END IF;

  -- Create default notification preferences
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
