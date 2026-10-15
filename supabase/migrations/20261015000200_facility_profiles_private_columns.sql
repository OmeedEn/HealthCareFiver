-- 20261015000200_facility_profiles_private_columns.sql
-- Stop exposing organizations' private details.
--
-- facility_profiles_select_public lets anyone (anon included) read approved
-- organizations' rows, and RLS can't filter columns, so EIN, address, phones,
-- contact email, legal name, license numbers, self-disclosures, attestations,
-- the lead person's credential and admin review notes were all readable
-- through the API by any visitor.
--
-- Fix: anon/authenticated keep row-level access (same policy) but only to the
-- public columns below. The organization reads its own full row through
-- my_facility_profile() (20261015000100, deployed with the app code first);
-- admin pages use the service role (unaffected).
-- Writes are unchanged: INSERT/UPDATE privileges are separate from SELECT.

REVOKE SELECT ON public.facility_profiles FROM anon, authenticated;

GRANT SELECT (
  id,
  facility_name,
  facility_type,
  description,
  website,
  city,
  state,
  zip_code,
  contact_name,
  contact_title,
  total_jobs_posted,
  average_rating,
  total_reviews,
  is_verified,
  verification_status,
  org_type,
  org_type_other,
  org_size,
  location_count,
  intents,
  looking_for,
  onboarding_step,
  onboarding_submitted_at,
  org_agreement_accepted_at,
  org_agreement_version,
  created_at,
  updated_at
) ON public.facility_profiles TO anon, authenticated;

