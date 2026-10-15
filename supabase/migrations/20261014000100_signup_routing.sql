-- Signup Routing Update: two-door signup (/signup → /signup/offer or
-- /signup/looking), the "Not sure" path with staff classification, and the
-- door-aware organization flow.
--
-- * profiles.signup_path — which door the person came through.
--     INDEPENDENT → role contractor
--     PRACTICE / COMPANY / HIRING → role facility (ORG_ADMIN)
--     CLIENT → role client
--     UNSURE → role client while classification_status = 'pending'
--       (the spec's PENDING_CLASSIFICATION account type: client-level access
--       — browse, save, book — but no messaging until staff place them).
-- * profiles.classification_status — staff placement lifecycle for UNSURE
--   signups: pending → needs_info (assigned, finishing the new flow) →
--   classified; or rejected.
-- * classification_requests — the Not sure answers staff review.
-- * facility_profiles lead-person credential (Company door, step 3) and the
--   new Company-door organization types.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_path TEXT
    CHECK (signup_path IS NULL OR signup_path IN ('INDEPENDENT', 'PRACTICE', 'COMPANY', 'HIRING', 'CLIENT', 'UNSURE')),
  ADD COLUMN IF NOT EXISTS classification_status TEXT
    CHECK (classification_status IS NULL OR classification_status IN ('pending', 'needs_info', 'classified', 'rejected'));

CREATE INDEX IF NOT EXISTS profiles_classification_status_idx
  ON profiles (classification_status) WHERE classification_status IS NOT NULL;

-- Door and placement are staff-controlled after signup, like role.
CREATE OR REPLACE FUNCTION public.protect_profiles_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.signup_path IS DISTINCT FROM OLD.signup_path OR
    NEW.classification_status IS DISTINCT FROM OLD.classification_status OR
    NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
    NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id OR
    NEW.subscription_price_id IS DISTINCT FROM OLD.subscription_price_id OR
    NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end OR
    NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
    NEW.stripe_connect_id IS DISTINCT FROM OLD.stripe_connect_id OR
    NEW.stripe_connect_onboarded IS DISTINCT FROM OLD.stripe_connect_onboarded OR
    NEW.is_active IS DISTINCT FROM OLD.is_active OR
    NEW.is_verified IS DISTINCT FROM OLD.is_verified
  ) AND NOT is_privileged_writer() THEN
    RAISE EXCEPTION 'Only admins can modify role, signup path, classification, subscription, billing or account status fields'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- Not sure answers (step 2 of /signup/unsure). One row per person; staff
-- decisions are recorded on the same row.
CREATE TABLE IF NOT EXISTS classification_requests (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  what_you_do TEXT NOT NULL CHECK (char_length(btrim(what_you_do)) BETWEEN 1 AND 300),
  team_size TEXT NOT NULL CHECK (team_size IN ('just_me', 'small_team', 'larger_org')),
  has_location BOOLEAN NOT NULL,
  credential TEXT NOT NULL CHECK (credential IN ('state_license', 'certification', 'none')),
  website TEXT CHECK (website IS NULL OR char_length(website) <= 300),
  wants TEXT[] NOT NULL DEFAULT '{}' CHECK (
    wants <@ ARRAY['offer_services', 'offer_consulting', 'host_events', 'find_professionals', 'post_needs', 'book_services']::text[]
  ),
  city TEXT NOT NULL CHECK (char_length(btrim(city)) BETWEEN 1 AND 100),
  state TEXT NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision TEXT CHECK (decision IS NULL OR decision IN ('INDEPENDENT', 'PRACTICE', 'COMPANY', 'CLIENT', 'REJECTED')),
  decision_note TEXT CHECK (decision_note IS NULL OR char_length(decision_note) <= 2000),
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ
);

ALTER TABLE classification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classification_requests_select_own ON classification_requests;
CREATE POLICY classification_requests_select_own ON classification_requests
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- Owners may file their answers once, only while awaiting placement and
-- without a decision. Updates/decisions go through the service role.
DROP POLICY IF EXISTS classification_requests_insert_own ON classification_requests;
CREATE POLICY classification_requests_insert_own ON classification_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND decision IS NULL AND decided_by IS NULL AND decided_at IS NULL AND decision_note IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.signup_path = 'UNSURE' AND p.classification_status = 'pending'
    )
  );

-- Company door, step 3: the lead person's credential instead of a facility license.
ALTER TABLE facility_profiles
  ADD COLUMN IF NOT EXISTS lead_has_credential BOOLEAN,
  ADD COLUMN IF NOT EXISTS lead_credential_type TEXT CHECK (lead_credential_type IS NULL OR char_length(lead_credential_type) <= 200),
  ADD COLUMN IF NOT EXISTS lead_credential_number TEXT CHECK (lead_credential_number IS NULL OR char_length(lead_credential_number) <= 100),
  ADD COLUMN IF NOT EXISTS lead_credential_state TEXT CHECK (lead_credential_state IS NULL OR lead_credential_state ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS lead_linkedin TEXT CHECK (lead_linkedin IS NULL OR char_length(lead_linkedin) <= 300);

-- Company-door organization types. 'startup' stays valid for existing rows.
DO $$
DECLARE _c TEXT;
BEGIN
  SELECT conname INTO _c FROM pg_constraint
   WHERE conrelid = 'public.facility_profiles'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%org_type = ANY%';
  IF _c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE facility_profiles DROP CONSTRAINT %I', _c);
  END IF;
END $$;
ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_org_type_check CHECK (
  org_type IS NULL OR org_type IN (
    'hospital', 'clinic', 'urgent_care', 'nursing_home', 'home_health', 'telehealth', 'med_spa',
    'gym', 'school', 'nonprofit', 'employer', 'government',
    'consulting', 'law_firm', 'billing_rcm', 'ceu_training', 'health_tech', 'staffing', 'marketing',
    'startup', 'other'
  )
);

-- Backfill the door for existing accounts.
UPDATE profiles SET signup_path = 'INDEPENDENT' WHERE signup_path IS NULL AND role = 'contractor';
UPDATE profiles SET signup_path = 'CLIENT' WHERE signup_path IS NULL AND role = 'client';
UPDATE profiles p SET signup_path = CASE
    WHEN f.org_type IN ('consulting', 'law_firm', 'billing_rcm', 'ceu_training', 'health_tech', 'staffing', 'marketing', 'startup')
      THEN 'COMPANY'
    ELSE 'PRACTICE'
  END
  FROM facility_profiles f
 WHERE f.id = p.id AND p.signup_path IS NULL AND p.role IN ('facility', 'staffing_agency');

-- New signups: store the door from signup metadata when it matches the role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _signup_path TEXT := NULLIF(NEW.raw_user_meta_data->>'signup_path', '');
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

  -- Signup routing door (Signup Routing Update). User-controlled metadata, so
  -- keep it only when it agrees with the role; anything else is NULL.
  IF NOT (
    (_role = 'contractor' AND _signup_path = 'INDEPENDENT') OR
    (_role IN ('facility', 'staffing_agency') AND _signup_path IN ('PRACTICE', 'COMPANY', 'HIRING')) OR
    (_role = 'client' AND _signup_path IN ('CLIENT', 'UNSURE'))
  ) THEN
    _signup_path := NULL;
  END IF;

  INSERT INTO profiles (id, role, email, phone, signup_path, classification_status)
  VALUES (
    NEW.id, _role, NEW.email, _phone, _signup_path,
    CASE WHEN _signup_path = 'UNSURE' THEN 'pending' END
  );

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
$function$;
