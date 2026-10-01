-- 20260930000011_onboarding_credential_types.sql
-- Professional onboarding v2 (step 4) collects a government photo ID from
-- everyone and a resume/CV from consultants, stored as `credentials` rows
-- (document_url = storage path in the private 'credentials' bucket).
--
-- Own migration: a newly added enum value cannot be used in the same
-- transaction that adds it. ADD VALUE IF NOT EXISTS is idempotent and only
-- touches the catalog (no table rewrite).
--
-- No policy/trigger change is needed for contractors to insert these types:
-- credentials_insert_own (contractor_id = auth.uid()) and
-- protect_credential_review_columns() (status must be pending_upload /
-- pending_review, no reviewer fields) are type-agnostic.
ALTER TYPE credential_type ADD VALUE IF NOT EXISTS 'government_id';
ALTER TYPE credential_type ADD VALUE IF NOT EXISTS 'resume';
