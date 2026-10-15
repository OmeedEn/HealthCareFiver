-- Single-Question Onboarding: Not sure flow (/signup/unsure).
--
-- The flow now asks four questions (what you do, team, license or
-- certification, website/LinkedIn) plus the account. Physical location,
-- "What do you want to do on Sanus?" and city/state moved to the dashboard
-- after staff assign a category, so those columns become optional. Rows
-- filed before this change keep their values; the existing CHECKs still
-- apply to non-null values (a CHECK on NULL passes).
--
-- New: review_consent_at records the account screen's "I confirm this
-- information is accurate and authorize Sanus to review it." checkbox.
--
-- The owner insert policy (classification_requests_insert_own) doesn't
-- reference any of these columns, so it's unchanged: owners may still file
-- their answers once, while pending, without a decision. Today every insert
-- goes through the service role (signup API / Google finish action).

ALTER TABLE classification_requests
  ALTER COLUMN has_location DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS review_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN classification_requests.has_location IS
  'Legacy Not sure answer (pre single-question flow). NULL = not asked; collected from the dashboard after placement.';
COMMENT ON COLUMN classification_requests.city IS
  'Legacy Not sure answer (pre single-question flow). NULL = not asked.';
COMMENT ON COLUMN classification_requests.state IS
  'Legacy Not sure answer (pre single-question flow). NULL = not asked.';
COMMENT ON COLUMN classification_requests.wants IS
  'Legacy Not sure answer (pre single-question flow). Empty = not asked.';
COMMENT ON COLUMN classification_requests.review_consent_at IS
  'When the person confirmed their answers are accurate and authorized Sanus to review them (account screen).';
