-- Broad professional category chosen on step 1 of /signup/professional.
-- Distinct from contractor_type (the granular license enum, which signup
-- defaults to 'other'). Contractors may edit this themselves on
-- /contractor/profile/edit, so it is intentionally NOT covered by
-- protect_verification_columns() (20260808000001), which only guards the
-- admin-owned verification_* / baa_sent_at / approval_email_sent_at columns.
ALTER TABLE contractor_profiles
  ADD COLUMN IF NOT EXISTS professional_category TEXT
  CHECK (professional_category IN ('clinical','allied','consultant','educator'));
