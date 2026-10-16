-- 20261016000300_organization_single_question.sql
-- Organization flow for the Single-Question Onboarding spec.
--
-- 1. facility_profiles.has_no_website: screen 4's "We don't have a website"
--    is an answer, not a blank. The review page and red flags read it as
--    declared. Private (not added to the public column grant in
--    20261015000200); the org reads it through my_facility_profile(), which
--    returns SETOF facility_profiles, and admins use the service role.
-- 2. org_documents.kind gains 'other' (the dashboard's "Additional
--    documents" item).
-- 3. Backfill onboarding_progress (flow 'organization') for existing
--    organizations from what's on file, so resume and the Finish your
--    profile checklist agree with their data. Question ids match
--    src/lib/onboarding/questions/organization.ts (ORG_FLOW_IDS).
--
-- facility_profiles.onboarding_step stays (no longer read for routing; the
-- submit action still writes 5, inside the existing 2..5 check).

ALTER TABLE public.facility_profiles
  ADD COLUMN IF NOT EXISTS has_no_website BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.org_documents DROP CONSTRAINT IF EXISTS org_documents_kind_check;
ALTER TABLE public.org_documents
  ADD CONSTRAINT org_documents_kind_check
  CHECK (kind = ANY (ARRAY['facility_license'::text, 'business_registration'::text, 'other'::text]));

-- Backfill. Door: COMPANY answers the lead person's credential question;
-- PRACTICE, HIRING and legacy (NULL) answer the facility license one.
INSERT INTO public.onboarding_progress (user_id, flow, answered, submitted_at)
SELECT
  f.id,
  'organization',
  array_remove(ARRAY[
    'account',
    CASE WHEN f.org_type IS NOT NULL
          AND (f.org_type <> 'other' OR NULLIF(BTRIM(f.org_type_other), '') IS NOT NULL)
         THEN 'org_type' END,
    CASE WHEN NULLIF(BTRIM(f.facility_name), '') IS NOT NULL THEN 'org_name' END,
    CASE WHEN NULLIF(BTRIM(f.website), '') IS NOT NULL OR f.has_no_website THEN 'org_website' END,
    CASE WHEN NULLIF(BTRIM(f.city), '') IS NOT NULL AND f.state ~ '^[A-Z]{2}$' THEN 'org_location' END,
    CASE WHEN (p.signup_path = 'COMPANY' AND f.lead_has_credential IS NOT NULL)
           OR (p.signup_path IS DISTINCT FROM 'COMPANY' AND f.has_facility_license IS NOT NULL)
         THEN 'license' END,
    CASE WHEN (p.signup_path = 'COMPANY' AND (f.lead_has_credential IS DISTINCT FROM true OR (
                 NULLIF(BTRIM(f.lead_credential_type), '') IS NOT NULL
                 AND NULLIF(BTRIM(f.lead_credential_number), '') IS NOT NULL
                 AND f.lead_credential_state IS NOT NULL)))
           OR (p.signup_path IS DISTINCT FROM 'COMPANY' AND (f.has_facility_license IS DISTINCT FROM true OR (
                 NULLIF(BTRIM(f.facility_license_type), '') IS NOT NULL
                 AND NULLIF(BTRIM(f.facility_license_number), '') IS NOT NULL
                 AND NULLIF(BTRIM(f.facility_license_agency), '') IS NOT NULL)))
         THEN 'license_details' END,
    CASE WHEN EXISTS (
           SELECT 1 FROM public.org_documents d
            WHERE d.facility_id = f.id AND d.kind IN ('business_registration', 'facility_license'))
         THEN 'registration_doc' END,
    CASE WHEN f.onboarding_submitted_at IS NOT NULL THEN 'submit' END
  ], NULL),
  f.onboarding_submitted_at
FROM public.facility_profiles f
JOIN public.profiles p ON p.id = f.id
ON CONFLICT (user_id, flow) DO NOTHING;
