-- Applying to posts (Organization Onboarding spec): "One-click apply uses
-- their Sanus profile, plus an optional note, their availability, and
-- answers to any screening questions." Also enforces the post's optional
-- applicant cap and application deadline.

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS availability TEXT CHECK (availability IS NULL OR char_length(availability) <= 500),
  ADD COLUMN IF NOT EXISTS screening_answers JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.enforce_job_application_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER  -- reads the job regardless of the applicant's RLS view
 SET search_path TO 'public'
AS $function$
DECLARE
  _job RECORD;
  _questions INTEGER;
  _answered INTEGER;
BEGIN
  SELECT status, application_deadline, applicant_cap, total_applicants,
         coalesce(array_length(screening_questions, 1), 0) AS q
  INTO _job FROM jobs WHERE id = NEW.job_id;

  IF NOT FOUND OR _job.status <> 'open' THEN
    RAISE EXCEPTION 'This post isn’t accepting applications.' USING ERRCODE = '42501', HINT = 'not_open';
  END IF;
  IF _job.application_deadline IS NOT NULL AND _job.application_deadline < CURRENT_DATE THEN
    RAISE EXCEPTION 'The application deadline for this post has passed.' USING ERRCODE = '42501', HINT = 'deadline_passed';
  END IF;
  IF _job.applicant_cap IS NOT NULL AND _job.total_applicants >= _job.applicant_cap THEN
    RAISE EXCEPTION 'This post has reached its applicant limit.' USING ERRCODE = '42501', HINT = 'cap_reached';
  END IF;

  _questions := _job.q;
  IF _questions > 0 THEN
    SELECT count(*) INTO _answered
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.screening_answers) = 'array' THEN NEW.screening_answers ELSE '[]'::jsonb END) a
    WHERE char_length(btrim(coalesce(a->>'answer', ''))) > 0;
    IF _answered < _questions THEN
      RAISE EXCEPTION 'Answer the screening questions to apply.' USING ERRCODE = '23514', HINT = 'screening_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS job_applications_limits ON job_applications;
CREATE TRIGGER job_applications_limits
  BEFORE INSERT ON job_applications
  FOR EACH ROW EXECUTE FUNCTION enforce_job_application_limits();
