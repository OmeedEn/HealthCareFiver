-- Signup Routing Update: atomic staff placement / category change.
--
-- admin_assign_signup_path() is what /admin/classification (Needs
-- classification queue) and the admin user page's "Change category" control
-- call through the service-role client (src/lib/admin/classification.ts). In
-- one transaction it:
--   * creates the profile row the new account type needs (contractor_profiles
--     for INDEPENDENT, facility_profiles for PRACTICE / COMPANY / HIRING),
--     prefilled with what we already know (name, city/state, website, phone),
--     or resets an existing one to the start of that category's onboarding
--     and verification;
--   * updates profiles.role / signup_path / classification_status;
--   * records the staff decision on classification_requests (queue only;
--     refuses a request that was already decided).
-- The old client_profiles row is never deleted.
--
-- REJECTED keeps the account a client (signup_path stays UNSURE) and only
-- sets classification_status = 'rejected'.
--
-- The app falls back to the same writes without a transaction when this
-- function is missing, so applying this migration is an upgrade, not a
-- prerequisite.

CREATE OR REPLACE FUNCTION public.admin_assign_signup_path(
  p_user_id UUID,
  p_path TEXT,
  p_admin_id UUID,
  p_decision TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_prefill JSONB DEFAULT '{}'::jsonb
)
 RETURNS JSONB
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _p profiles%ROWTYPE;
  _req classification_requests%ROWTYPE;
  _role user_role;
  _status TEXT;
  _first TEXT := LEFT(BTRIM(COALESCE(p_prefill->>'first_name', '')), 100);
  _last TEXT := LEFT(BTRIM(COALESCE(p_prefill->>'last_name', '')), 100);
  _city TEXT := NULLIF(LEFT(BTRIM(COALESCE(p_prefill->>'city', '')), 100), '');
  _state TEXT := NULLIF(UPPER(BTRIM(COALESCE(p_prefill->>'state', ''))), '');
  _zip TEXT := NULLIF(BTRIM(COALESCE(p_prefill->>'zip_code', '')), '');
  _website TEXT := NULLIF(LEFT(BTRIM(COALESCE(p_prefill->>'website', '')), 300), '');
  _linkedin TEXT := NULLIF(LEFT(BTRIM(COALESCE(p_prefill->>'linkedin', '')), 300), '');
  _phone TEXT := NULLIF(BTRIM(COALESCE(p_prefill->>'phone', '')), '');
  _contact TEXT;
BEGIN
  IF _state IS NOT NULL AND _state !~ '^[A-Z]{2}$' THEN _state := NULL; END IF;
  IF _zip IS NOT NULL AND _zip !~ '^\d{5}$' THEN _zip := NULL; END IF;
  _contact := NULLIF(LEFT(BTRIM(_first || ' ' || _last), 200), '');

  SELECT * INTO _p FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account % not found', p_user_id USING ERRCODE = 'P0002';
  END IF;
  IF _p.role = 'admin' THEN
    RAISE EXCEPTION 'Admin accounts can''t be reassigned' USING ERRCODE = '42501';
  END IF;

  IF p_decision IS NOT NULL THEN
    IF p_decision NOT IN ('INDEPENDENT', 'PRACTICE', 'COMPANY', 'CLIENT', 'REJECTED') THEN
      RAISE EXCEPTION 'Unknown decision %', p_decision USING ERRCODE = '22023';
    END IF;
    -- A Not sure account may not have answered step 2 yet; staff can still
    -- place it, there's just no request row to record the decision on.
    SELECT * INTO _req FROM classification_requests WHERE user_id = p_user_id FOR UPDATE;
    IF FOUND AND _req.decision IS NOT NULL THEN
      RAISE EXCEPTION 'This request was already decided (%)', _req.decision USING ERRCODE = '55000';
    END IF;
  END IF;

  IF p_decision = 'REJECTED' THEN
    UPDATE profiles SET classification_status = 'rejected' WHERE id = p_user_id;
    _role := _p.role;
    _status := 'rejected';
  ELSE
    IF p_path IS NULL OR p_path NOT IN ('INDEPENDENT', 'PRACTICE', 'COMPANY', 'HIRING', 'CLIENT') THEN
      RAISE EXCEPTION 'Unknown category %', p_path USING ERRCODE = '22023';
    END IF;
    IF p_decision IS NOT NULL AND p_decision <> p_path THEN
      RAISE EXCEPTION 'Decision % does not match category %', p_decision, p_path USING ERRCODE = '22023';
    END IF;

    _role := CASE
      WHEN p_path = 'INDEPENDENT' THEN 'contractor'::user_role
      WHEN p_path = 'CLIENT' THEN 'client'::user_role
      ELSE 'facility'::user_role
    END;
    -- Placed Not sure accounts: needs_info while they finish the new flow,
    -- classified for clients. Accounts that never went through Not sure
    -- keep a NULL classification_status.
    _status := CASE
      WHEN _p.classification_status IS NULL AND p_decision IS NULL THEN NULL
      WHEN p_path = 'CLIENT' THEN 'classified'
      ELSE 'needs_info'
    END;

    IF p_path = 'INDEPENDENT' THEN
      INSERT INTO contractor_profiles (id, first_name, last_name, contractor_type, city, state, zip_code, website_url)
      VALUES (p_user_id, _first, _last, 'other', _city, _state, _zip, COALESCE(_website, _linkedin))
      ON CONFLICT (id) DO UPDATE SET
        first_name = COALESCE(NULLIF(contractor_profiles.first_name, ''), EXCLUDED.first_name),
        last_name = COALESCE(NULLIF(contractor_profiles.last_name, ''), EXCLUDED.last_name),
        city = COALESCE(contractor_profiles.city, EXCLUDED.city),
        state = COALESCE(contractor_profiles.state, EXCLUDED.state),
        zip_code = COALESCE(contractor_profiles.zip_code, EXCLUDED.zip_code),
        website_url = COALESCE(contractor_profiles.website_url, EXCLUDED.website_url),
        -- Start professional onboarding + verification over.
        verification_status = 'not_submitted',
        verification_notes = NULL,
        verification_reviewed_by = NULL,
        verification_reviewed_at = NULL,
        onboarding_completed_at = NULL,
        onboarding_step = 2;
    ELSIF p_path IN ('PRACTICE', 'COMPANY', 'HIRING') THEN
      INSERT INTO facility_profiles (
        id, facility_name, facility_type, contact_name, contact_email, contact_phone,
        phone, city, state, zip_code, website, lead_linkedin
      )
      VALUES (
        p_user_id, '', 'other', _contact, _p.email, _phone,
        _phone, _city, _state, _zip, _website,
        CASE WHEN p_path = 'COMPANY' THEN _linkedin END
      )
      ON CONFLICT (id) DO UPDATE SET
        contact_name = COALESCE(facility_profiles.contact_name, EXCLUDED.contact_name),
        contact_email = COALESCE(facility_profiles.contact_email, EXCLUDED.contact_email),
        contact_phone = COALESCE(facility_profiles.contact_phone, EXCLUDED.contact_phone),
        phone = COALESCE(facility_profiles.phone, EXCLUDED.phone),
        city = COALESCE(facility_profiles.city, EXCLUDED.city),
        state = COALESCE(facility_profiles.state, EXCLUDED.state),
        zip_code = COALESCE(facility_profiles.zip_code, EXCLUDED.zip_code),
        website = COALESCE(facility_profiles.website, EXCLUDED.website),
        lead_linkedin = COALESCE(facility_profiles.lead_linkedin, EXCLUDED.lead_linkedin),
        -- The door decides the verify step, so go through onboarding again
        -- and back into review.
        verification_status = 'pending_review',
        verification_notes = NULL,
        verification_reviewed_by = NULL,
        verification_reviewed_at = NULL,
        onboarding_submitted_at = NULL,
        onboarding_step = 2;
    ELSE
      -- CLIENT: make sure a client_profiles row exists.
      INSERT INTO client_profiles (id, first_name, last_name, city, state, zip_code)
      VALUES (p_user_id, _first, _last, _city, _state, _zip)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    UPDATE profiles SET
      role = _role,
      signup_path = p_path,
      classification_status = _status,
      is_verified = CASE WHEN p_path = 'CLIENT' THEN is_verified ELSE false END
    WHERE id = p_user_id;
  END IF;

  IF p_decision IS NOT NULL THEN
    UPDATE classification_requests SET
      decision = p_decision,
      decision_note = NULLIF(LEFT(BTRIM(COALESCE(p_note, '')), 2000), ''),
      decided_by = p_admin_id,
      decided_at = now()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'old_role', _p.role,
    'old_signup_path', _p.signup_path,
    'old_classification_status', _p.classification_status,
    'new_role', _role,
    'new_signup_path', CASE WHEN p_decision = 'REJECTED' THEN _p.signup_path ELSE p_path END,
    'new_classification_status', _status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_assign_signup_path(UUID, TEXT, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_signup_path(UUID, TEXT, UUID, TEXT, TEXT, JSONB) TO service_role;
