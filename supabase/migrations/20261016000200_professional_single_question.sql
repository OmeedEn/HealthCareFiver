-- Professional Single-Question Onboarding: backfill onboarding_progress.
--
-- The new /onboarding/professional flow resumes on the first question id in
-- neither onboarding_progress.answered nor .skipped (ids from
-- src/lib/onboarding/questions/professional.ts). Existing professionals
-- answered the old wizard, so seed their progress from the data they
-- already gave. Rows the new flow already wrote are left alone.
--
-- contractor_profiles.onboarding_step is no longer read or written; its
-- default (2) still satisfies its 2..6 CHECK, so it needs no change.
--
-- Not applied automatically: dry-run inside BEGIN … ROLLBACK first.

WITH cp AS (
  SELECT
    c.id,
    c.professional_category AS category,
    c.credential_basis AS basis,
    CASE
      WHEN c.professional_category IN ('clinical', 'allied', 'consultant', 'educator') THEN c.professional_category
      WHEN c.professional_category = 'other' AND c.credential_basis = 'license' THEN 'clinical'
      WHEN c.professional_category = 'other' AND c.credential_basis = 'certification' THEN 'allied'
      WHEN c.professional_category = 'other' AND c.credential_basis = 'none' THEN 'consultant'
    END AS branch,
    c.license_type,
    c.certification_type,
    c.specialties,
    c.teaching_topics,
    c.other_profession,
    c.state_license_number,
    c.license_state,
    c.certifying_organization,
    c.website_url,
    c.onboarding_step,
    c.self_disclosures,
    c.verification_status::text AS verification_status,
    c.onboarding_completed_at,
    EXISTS (
      SELECT 1 FROM credentials k
       WHERE k.contractor_id = c.id AND k.document_url IS NOT NULL AND k.status::text <> 'rejected'
         AND k.credential_type::text = ANY (
           CASE WHEN c.professional_category IN ('consultant', 'educator')
                  OR (c.professional_category = 'other' AND c.credential_basis = 'none')
                THEN ARRAY['resume'] ELSE ARRAY['license', 'certification'] END)
    ) AS has_credential,
    EXISTS (
      SELECT 1 FROM credentials k
       WHERE k.contractor_id = c.id AND k.document_url IS NOT NULL AND k.status::text <> 'rejected'
         AND k.credential_type::text = 'government_id'
    ) AS has_id
  FROM contractor_profiles c
),
ids AS (
  SELECT
    cp.*,
    array_remove(ARRAY[
      'account',
      CASE WHEN category IS NOT NULL THEN 'category' END,
      CASE WHEN category IN ('clinical', 'allied', 'consultant', 'educator') AND (
             (category = 'clinical' AND nullif(btrim(license_type), '') IS NOT NULL) OR
             (category = 'allied' AND nullif(btrim(certification_type), '') IS NOT NULL) OR
             (category = 'consultant' AND cardinality(coalesce(specialties, '{}')) > 0) OR
             (category = 'educator' AND nullif(btrim(teaching_topics), '') IS NOT NULL)
           ) THEN 'profession' END,
      CASE WHEN category = 'other' AND nullif(btrim(other_profession), '') IS NOT NULL THEN 'other_profession' END,
      CASE WHEN category = 'other' AND basis IS NOT NULL THEN 'credential_basis' END,
      CASE WHEN branch = 'clinical' AND nullif(btrim(state_license_number), '') IS NOT NULL
             AND license_state IS NOT NULL THEN 'license' END,
      CASE WHEN branch = 'allied' AND nullif(btrim(certifying_organization), '') IS NOT NULL THEN 'certifying_org' END,
      -- The old wizard's link was optional: having passed step 3 counts as answered.
      CASE WHEN branch IN ('consultant', 'educator')
             AND (website_url IS NOT NULL OR onboarding_step >= 4 OR onboarding_completed_at IS NOT NULL)
           THEN 'website' END,
      CASE WHEN has_credential THEN 'credential_upload' END,
      CASE WHEN has_id THEN 'government_id' END,
      CASE WHEN branch IN ('clinical', 'allied')
             AND (SELECT count(*) FROM jsonb_each(self_disclosures) d
                   WHERE d.key IN ('license_action', 'exclusion', 'conviction', 'malpractice')
                     AND jsonb_typeof(d.value -> 'answer') = 'boolean') = 4
           THEN 'disclosures' END,
      CASE WHEN verification_status <> 'not_submitted' THEN 'submit' END
    ], NULL) AS answered,
    -- Submitted without an upload: it's a Finish your profile item now.
    CASE WHEN verification_status <> 'not_submitted' THEN
      array_remove(ARRAY[
        CASE WHEN NOT has_credential THEN 'credential_upload' END,
        CASE WHEN NOT has_id THEN 'government_id' END
      ], NULL)
    ELSE '{}'::text[] END AS skipped
  FROM cp
)
INSERT INTO onboarding_progress (user_id, flow, answered, skipped, submitted_at)
SELECT
  ids.id,
  'professional',
  ids.answered,
  ids.skipped,
  CASE WHEN ids.verification_status <> 'not_submitted'
       THEN coalesce(ids.onboarding_completed_at, now()) END
FROM ids
JOIN profiles p ON p.id = ids.id AND p.role = 'contractor'
ON CONFLICT (user_id, flow) DO NOTHING;
