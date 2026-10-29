-- Verify later for buyers (Hiring door).
--
-- Organizations that sign up through the Hiring door now reach the
-- dashboard after type, name and city/state, before they've submitted
-- verification (facility_profiles.onboarding_submitted_at IS NULL). The app
-- sends them into verification when they first request a booking
-- (src/lib/bookings/actions.ts); this trigger enforces the same rule for
-- request_org_booking() called straight from the API.
--
-- Scope: only an organization booking for itself (customer_id = auth.uid())
-- whose verification isn't submitted. Clients, professionals, submitted
-- organizations (approved or still under review, as before) and staff are
-- unaffected. No data changes.

CREATE OR REPLACE FUNCTION public.org_bookings_require_submitted_org_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.customer_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.facility_profiles
    WHERE id = NEW.customer_id AND onboarding_submitted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Verify your organization before booking.'
      USING ERRCODE = '42501', HINT = 'org_verification_required';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_bookings_require_submitted_org_customer() FROM PUBLIC;

DROP TRIGGER IF EXISTS org_bookings_require_submitted_org_customer ON public.org_bookings;
CREATE TRIGGER org_bookings_require_submitted_org_customer
  BEFORE INSERT ON public.org_bookings
  FOR EACH ROW EXECUTE FUNCTION public.org_bookings_require_submitted_org_customer();
