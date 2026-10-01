-- Add the job columns the app reads and writes.
--
-- The jobs UI (contractor job list/detail, dashboard, facility "post a job"
-- form, src/lib/validators/job.ts) uses pay_rate_min/max/type,
-- shifts_per_week, hours_per_shift, years_experience_min and
-- required_credentials, but the table only had hourly_rate_min/max,
-- hours_per_week, years_experience_required and required_certifications.
-- Every jobs query from the app failed with "column jobs.pay_rate_min does not
-- exist", so no jobs ever showed and posting a job failed.
--
-- Additive and idempotent; existing rows are backfilled from the old columns.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pay_rate_min NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_rate_max NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_rate_type TEXT NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS shifts_per_week INTEGER,
  ADD COLUMN IF NOT EXISTS hours_per_shift NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS years_experience_min INTEGER,
  ADD COLUMN IF NOT EXISTS required_credentials TEXT[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_pay_rate_type_check
    CHECK (pay_rate_type IN ('hourly', 'daily', 'weekly', 'per_contract'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.jobs SET
  pay_rate_min = COALESCE(pay_rate_min, hourly_rate_min),
  pay_rate_max = COALESCE(pay_rate_max, hourly_rate_max),
  years_experience_min = COALESCE(years_experience_min, years_experience_required),
  required_credentials = CASE
    WHEN required_credentials = '{}' AND required_certifications IS NOT NULL
      THEN required_certifications
    ELSE required_credentials
  END;
