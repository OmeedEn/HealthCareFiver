-- Fix handle_new_user(): pin search_path to `public`.
--
-- 20260705000001_harden_signup_trigger.sql's version of this function relies
-- on unqualified type/table names (user_role, contractor_type,
-- facility_type, profiles, ...) resolving via the session's search_path.
-- That works for connections whose default search_path includes `public`
-- (e.g. the `postgres` role), but GoTrue's own connection role
-- (`supabase_auth_admin`) does not have `public` on its search_path, so
-- every real signup failed with `type "user_role" does not exist` (42704),
-- surfaced to users as the opaque "Database error saving new user".
--
-- SECURITY DEFINER functions should always pin search_path explicitly for
-- exactly this reason (and to avoid search_path-based privilege escalation)
-- — the function body is otherwise identical to the harden migration.

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

  INSERT INTO profiles (id, role, email)
  VALUES (NEW.id, _role, NEW.email);

  IF _role = 'contractor' THEN
    INSERT INTO contractor_profiles (id, first_name, last_name, contractor_type)
    VALUES (NEW.id, _first_name, _last_name, _contractor_type);
  ELSIF _role = 'facility' OR _role = 'staffing_agency' THEN
    INSERT INTO facility_profiles (id, facility_name, facility_type)
    VALUES (NEW.id, _facility_name, _facility_type);
  END IF;

  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
