-- 20261015000400_org_booking_payments.sql
-- Bookings phase 4: customers pay through Sanus, Sanus pays the organization.
--
-- Money flow (Stripe "separate charges and transfers"):
--   accepted --(customer pays via Checkout)--> paid --(48h after the booking,
--   daily cron transfers price minus the Sanus fee)--> completed.
-- The charge lands in Sanus's balance; nothing reaches the organization until
-- the payout, so refunds before then are plain refunds.
--
-- Cancellation policy (Booking Terms):
--   * Organization cancels a paid booking: full refund, any time.
--   * Customer cancels 48h or more before the start: full refund.
--   * Customer cancels later: no refund; the organization is still paid.
--
-- Stripe calls happen in the app (refunds, transfers); these functions keep
-- the state transitions atomic. The *_settle functions are service-role only
-- and are called by the webhook, the cron, and server actions after Stripe
-- confirms.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.org_bookings DROP CONSTRAINT IF EXISTS org_bookings_status_check;
ALTER TABLE public.org_bookings ADD CONSTRAINT org_bookings_status_check
  CHECK (status IN ('requested', 'quoted', 'accepted', 'paid', 'completed', 'declined', 'cancelled'));

ALTER TABLE public.org_bookings
  -- none -> paid -> (refund_pending -> refunded)
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'none'
    CHECK (payment_status IN ('none', 'paid', 'refund_pending', 'refunded')),
  ADD COLUMN IF NOT EXISTS amount_paid_cents INTEGER CHECK (amount_paid_cents IS NULL OR amount_paid_cents >= 0),
  ADD COLUMN IF NOT EXISTS fee_cents INTEGER CHECK (fee_cents IS NULL OR fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_cents INTEGER CHECK (refund_cents IS NULL OR refund_cents >= 0),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  -- none -> scheduled -> paid; scheduled -> on_hold (dispute) | cancelled (refund)
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'none'
    CHECK (payout_status IN ('none', 'scheduled', 'on_hold', 'paid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payout_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_bookings_payment_intent
  ON public.org_bookings (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_bookings_payout_due
  ON public.org_bookings (payout_due_at) WHERE payout_status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_org_bookings_refund_pending
  ON public.org_bookings (updated_at) WHERE payment_status = 'refund_pending';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- When the booking happens: the confirmed time for services, the event start
-- for events.
CREATE OR REPLACE FUNCTION public.org_booking_start(b public.org_bookings)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN b.kind = 'event'
    THEN NULLIF(b.listing_snapshot->>'starts_at', '')::timestamptz
    ELSE b.scheduled_start
  END;
$$;

-- Spots held on an event: accepted (awaiting payment), paid, or completed.
CREATE OR REPLACE FUNCTION public.org_listing_spots_taken(p_listing_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(quantity), 0)::int FROM public.org_bookings
  WHERE listing_id = p_listing_id AND status IN ('accepted', 'paid', 'completed');
$$;
REVOKE ALL ON FUNCTION public.org_listing_spots_taken(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Customer: request a booking (unchanged except capacity counts paid spots)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_org_booking(
  p_listing_id UUID,
  p_quantity INTEGER,
  p_requested_start TIMESTAMPTZ,
  p_note TEXT,
  p_terms_version TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  l public.org_listings%ROWTYPE;
  v_org_name TEXT;
  v_org_status TEXT;
  v_qty INTEGER;
  v_price INTEGER;
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to book.' USING HINT = 'not_signed_in';
  END IF;

  SELECT * INTO l FROM public.org_listings WHERE id = p_listing_id;
  SELECT facility_name, verification_status INTO v_org_name, v_org_status
    FROM public.facility_profiles WHERE id = l.facility_id;
  IF l.id IS NULL OR l.status <> 'published' OR v_org_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'This listing isn''t available.' USING HINT = 'listing_unavailable';
  END IF;
  IF l.facility_id = v_uid THEN
    RAISE EXCEPTION 'You can''t book your own listing.' USING HINT = 'own_listing';
  END IF;
  IF l.kind = 'event' AND l.starts_at IS NOT NULL AND l.starts_at < NOW() THEN
    RAISE EXCEPTION 'This event has already happened.' USING HINT = 'event_past';
  END IF;
  IF COALESCE(p_terms_version, '') = '' THEN
    RAISE EXCEPTION 'Please accept the booking terms.' USING HINT = 'terms_required';
  END IF;
  IF char_length(COALESCE(v_note, '')) > 2000 THEN
    RAISE EXCEPTION 'Keep your note under 2000 characters.' USING HINT = 'note_too_long';
  END IF;
  IF public.booking_text_has_contact_info(v_note) THEN
    RAISE EXCEPTION 'Contact details aren''t allowed.' USING HINT = 'contact_info';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.org_bookings
    WHERE customer_id = v_uid AND listing_id = l.id AND status IN ('requested', 'quoted')
  ) THEN
    RAISE EXCEPTION 'You already have an open request for this.' USING HINT = 'already_requested';
  END IF;
  IF (SELECT count(*) FROM public.org_bookings WHERE customer_id = v_uid AND status IN ('requested', 'quoted')) >= 20 THEN
    RAISE EXCEPTION 'Too many open requests.' USING HINT = 'too_many_open';
  END IF;

  v_qty := CASE WHEN l.kind = 'event' THEN GREATEST(1, LEAST(COALESCE(p_quantity, 1), 50)) ELSE 1 END;

  IF l.kind = 'event' AND l.capacity IS NOT NULL
     AND public.org_listing_spots_taken(l.id) + v_qty > l.capacity THEN
    RAISE EXCEPTION 'Not enough spots left.' USING HINT = 'event_full';
  END IF;

  v_price := CASE
    WHEN l.kind = 'event' AND l.is_free THEN 0
    WHEN l.kind = 'event' THEN l.price_cents * v_qty
    WHEN l.contact_for_pricing OR l.reach_via = 'inquiry' THEN NULL  -- needs a quote
    ELSE l.price_cents
  END;

  INSERT INTO public.org_bookings (
    listing_id, org_id, customer_id, kind, listing_snapshot, quantity,
    requested_start, note, price_cents, terms_version
  ) VALUES (
    l.id, l.facility_id, v_uid, l.kind,
    jsonb_build_object(
      'title', l.title, 'description', l.description, 'format', l.format,
      'locations', l.locations, 'price_cents', l.price_cents,
      'contact_for_pricing', l.contact_for_pricing, 'is_free', l.is_free,
      'reach_via', l.reach_via, 'event_type', l.event_type,
      'starts_at', l.starts_at, 'capacity', l.capacity, 'offers_ceu', l.offers_ceu,
      'org_name', v_org_name
    ),
    v_qty,
    CASE WHEN l.kind = 'service' THEN p_requested_start END,
    v_note, v_price, p_terms_version
  ) RETURNING id INTO v_id;

  PERFORM public.booking_notify(
    l.facility_id,
    CASE WHEN l.kind = 'event' THEN 'New registration request' ELSE 'New booking request' END,
    l.title, v_id
  );
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Organization: accept, quote, decline, or cancel
--   * Paid services need a confirmed time (payment and the 48-hour rule key
--     off it).
--   * Cancelling a paid booking refunds the customer in full.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_org_booking(
  p_booking_id UUID,
  p_action TEXT,
  p_price_cents INTEGER,
  p_scheduled_start TIMESTAMPTZ,
  p_note TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  b public.org_bookings%ROWTYPE;
  v_cap INTEGER;
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_title TEXT;
  v_time TIMESTAMPTZ;
BEGIN
  SELECT * INTO b FROM public.org_bookings WHERE id = p_booking_id FOR UPDATE;
  IF b.id IS NULL OR v_uid IS NULL OR b.org_id <> v_uid THEN
    RAISE EXCEPTION 'Booking not found.' USING HINT = 'not_found';
  END IF;
  IF char_length(COALESCE(v_note, '')) > 2000 THEN
    RAISE EXCEPTION 'Keep your note under 2000 characters.' USING HINT = 'note_too_long';
  END IF;
  IF public.booking_text_has_contact_info(v_note) THEN
    RAISE EXCEPTION 'Contact details aren''t allowed.' USING HINT = 'contact_info';
  END IF;
  v_title := b.listing_snapshot->>'title';
  v_time := CASE WHEN b.kind = 'service' THEN COALESCE(p_scheduled_start, b.requested_start) END;

  IF p_action = 'accept' THEN
    IF b.status <> 'requested' THEN
      RAISE EXCEPTION 'This request was already answered.' USING HINT = 'wrong_status';
    END IF;
    IF b.price_cents IS NULL THEN
      RAISE EXCEPTION 'Send a quote with a price first.' USING HINT = 'quote_required';
    END IF;
    IF b.kind = 'service' AND b.price_cents > 0 AND v_time IS NULL THEN
      RAISE EXCEPTION 'Set the date and time.' USING HINT = 'time_required';
    END IF;
    IF v_time IS NOT NULL AND v_time < NOW() THEN
      RAISE EXCEPTION 'Pick a time in the future.' USING HINT = 'time_past';
    END IF;
    IF b.kind = 'event' AND b.listing_id IS NOT NULL THEN
      SELECT capacity INTO v_cap FROM public.org_listings WHERE id = b.listing_id;
      IF v_cap IS NOT NULL AND public.org_listing_spots_taken(b.listing_id) + b.quantity > v_cap THEN
        RAISE EXCEPTION 'Not enough spots left.' USING HINT = 'event_full';
      END IF;
    END IF;
    UPDATE public.org_bookings SET
      status = 'accepted', scheduled_start = v_time, org_note = v_note, responded_at = NOW()
    WHERE id = b.id;
    PERFORM public.booking_notify(
      b.customer_id,
      CASE WHEN b.price_cents > 0 THEN 'Accepted: pay to confirm your booking' ELSE 'Your booking was accepted' END,
      v_title, b.id
    );

  ELSIF p_action = 'quote' THEN
    IF b.status <> 'requested' THEN
      RAISE EXCEPTION 'This request was already answered.' USING HINT = 'wrong_status';
    END IF;
    IF p_price_cents IS NULL OR p_price_cents < 0 OR p_price_cents > 100000000 THEN
      RAISE EXCEPTION 'Enter a price for the quote.' USING HINT = 'price_required';
    END IF;
    IF b.kind = 'service' AND p_price_cents > 0 AND v_time IS NULL THEN
      RAISE EXCEPTION 'Set the date and time.' USING HINT = 'time_required';
    END IF;
    IF v_time IS NOT NULL AND v_time < NOW() THEN
      RAISE EXCEPTION 'Pick a time in the future.' USING HINT = 'time_past';
    END IF;
    UPDATE public.org_bookings SET
      status = 'quoted', price_cents = p_price_cents, scheduled_start = v_time,
      org_note = v_note, responded_at = NOW()
    WHERE id = b.id;
    PERFORM public.booking_notify(b.customer_id, 'You received a quote', v_title, b.id);

  ELSIF p_action = 'decline' THEN
    IF b.status NOT IN ('requested', 'quoted') THEN
      RAISE EXCEPTION 'This request can''t be declined now.' USING HINT = 'wrong_status';
    END IF;
    UPDATE public.org_bookings SET status = 'declined', org_note = v_note, responded_at = NOW()
    WHERE id = b.id;
    PERFORM public.booking_notify(b.customer_id, 'Your booking request was declined', v_title, b.id);

  ELSIF p_action = 'cancel' THEN
    IF b.status NOT IN ('accepted', 'paid') THEN
      RAISE EXCEPTION 'This booking can''t be cancelled now.' USING HINT = 'wrong_status';
    END IF;
    UPDATE public.org_bookings SET
      status = 'cancelled', cancelled_at = NOW(), cancelled_by = v_uid,
      org_note = COALESCE(v_note, org_note),
      -- The organization cancelled: the customer gets everything back.
      payment_status = CASE WHEN b.payment_status = 'paid' THEN 'refund_pending' ELSE b.payment_status END,
      refund_cents = CASE WHEN b.payment_status = 'paid' THEN b.amount_paid_cents ELSE b.refund_cents END,
      payout_status = CASE WHEN b.payment_status = 'paid' THEN 'cancelled' ELSE b.payout_status END
    WHERE id = b.id;
    PERFORM public.booking_notify(
      b.customer_id,
      CASE WHEN b.payment_status = 'paid' THEN 'Your booking was cancelled: full refund on the way' ELSE 'Your booking was cancelled' END,
      v_title, b.id
    );

  ELSE
    RAISE EXCEPTION 'Unknown action.' USING HINT = 'bad_action';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Customer: accept a quote or cancel
--   Cancelling a paid booking 48h+ before the start refunds in full; later,
--   there's no refund and the organization is still paid.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_org_booking_action(
  p_booking_id UUID,
  p_action TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  b public.org_bookings%ROWTYPE;
  v_title TEXT;
  v_refund BOOLEAN;
BEGIN
  SELECT * INTO b FROM public.org_bookings WHERE id = p_booking_id FOR UPDATE;
  IF b.id IS NULL OR v_uid IS NULL OR b.customer_id <> v_uid THEN
    RAISE EXCEPTION 'Booking not found.' USING HINT = 'not_found';
  END IF;
  v_title := b.listing_snapshot->>'title';

  IF p_action = 'accept_quote' THEN
    IF b.status <> 'quoted' THEN
      RAISE EXCEPTION 'There''s no quote to accept.' USING HINT = 'wrong_status';
    END IF;
    UPDATE public.org_bookings SET status = 'accepted' WHERE id = b.id;
    PERFORM public.booking_notify(b.org_id, 'Quote accepted', v_title, b.id);

  ELSIF p_action = 'cancel' THEN
    IF b.status NOT IN ('requested', 'quoted', 'accepted', 'paid') THEN
      RAISE EXCEPTION 'This booking can''t be cancelled.' USING HINT = 'wrong_status';
    END IF;
    IF b.status = 'paid' THEN
      v_refund := public.org_booking_start(b) IS NULL
        OR NOW() <= public.org_booking_start(b) - INTERVAL '48 hours';
      UPDATE public.org_bookings SET
        status = 'cancelled', cancelled_at = NOW(), cancelled_by = v_uid,
        payment_status = CASE WHEN v_refund THEN 'refund_pending' ELSE payment_status END,
        refund_cents = CASE WHEN v_refund THEN amount_paid_cents ELSE refund_cents END,
        -- Late cancellation: the organization keeps its payout.
        payout_status = CASE WHEN v_refund THEN 'cancelled' ELSE payout_status END
      WHERE id = b.id;
      PERFORM public.booking_notify(
        b.org_id,
        CASE WHEN v_refund THEN 'Booking cancelled by the customer (refunded)'
             ELSE 'Booking cancelled by the customer (inside 48 hours: you''re still paid)' END,
        v_title, b.id
      );
    ELSE
      UPDATE public.org_bookings SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = v_uid
      WHERE id = b.id;
      PERFORM public.booking_notify(b.org_id, 'Booking cancelled by the customer', v_title, b.id);
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown action.' USING HINT = 'bad_action';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Service role: record Stripe outcomes
-- ---------------------------------------------------------------------------

-- A Checkout payment succeeded. Returns:
--   'paid'      booking confirmed
--   'duplicate' this payment was already recorded (webhook retry)
--   'refund'    the booking can't take this payment (cancelled meanwhile,
--               amount mismatch, or a second payment): refund it
CREATE OR REPLACE FUNCTION public.org_booking_settle_payment(
  p_booking_id UUID,
  p_session_id TEXT,
  p_payment_intent_id TEXT,
  p_charge_id TEXT,
  p_amount_cents INTEGER,
  p_fee_cents INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.org_bookings%ROWTYPE;
  v_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO b FROM public.org_bookings WHERE id = p_booking_id FOR UPDATE;
  IF b.id IS NULL THEN
    RETURN 'refund';
  END IF;
  IF b.stripe_payment_intent_id = p_payment_intent_id THEN
    RETURN 'duplicate';
  END IF;
  IF b.status <> 'accepted' OR b.payment_status <> 'none' OR b.price_cents IS DISTINCT FROM p_amount_cents THEN
    RETURN 'refund';
  END IF;

  v_start := public.org_booking_start(b);
  UPDATE public.org_bookings SET
    status = 'paid',
    payment_status = 'paid',
    amount_paid_cents = p_amount_cents,
    fee_cents = LEAST(GREATEST(p_fee_cents, 0), p_amount_cents),
    paid_at = NOW(),
    stripe_checkout_session_id = p_session_id,
    stripe_payment_intent_id = p_payment_intent_id,
    stripe_charge_id = p_charge_id,
    payout_status = 'scheduled',
    -- Paid out 48 hours after the booking. No start time: an admin releases it.
    payout_due_at = v_start + INTERVAL '48 hours'
  WHERE id = b.id;

  PERFORM public.booking_notify(b.customer_id, 'Payment received: you''re booked', b.listing_snapshot->>'title', b.id);
  PERFORM public.booking_notify(b.org_id, 'Booking paid', b.listing_snapshot->>'title', b.id);
  RETURN 'paid';
END;
$$;

-- A refund went through.
CREATE OR REPLACE FUNCTION public.org_booking_settle_refund(p_booking_id UUID, p_refund_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.org_bookings%ROWTYPE;
BEGIN
  UPDATE public.org_bookings SET
    payment_status = 'refunded', refunded_at = NOW(), stripe_refund_id = p_refund_id
  WHERE id = p_booking_id AND payment_status = 'refund_pending'
  RETURNING * INTO b;
  IF b.id IS NOT NULL THEN
    PERFORM public.booking_notify(b.customer_id, 'Refund issued', b.listing_snapshot->>'title', b.id);
  END IF;
END;
$$;

-- The organization's payout went through.
CREATE OR REPLACE FUNCTION public.org_booking_settle_payout(p_booking_id UUID, p_transfer_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.org_bookings%ROWTYPE;
BEGIN
  UPDATE public.org_bookings SET
    payout_status = 'paid', paid_out_at = NOW(), stripe_transfer_id = p_transfer_id,
    status = CASE WHEN status = 'paid' THEN 'completed' ELSE status END
  WHERE id = p_booking_id AND payout_status = 'scheduled'
  RETURNING * INTO b;
  IF b.id IS NOT NULL THEN
    PERFORM public.booking_notify(b.org_id, 'Payout sent', b.listing_snapshot->>'title', b.id);
  END IF;
END;
$$;

-- Accepted bookings nobody paid for by the time they start free their spot.
CREATE OR REPLACE FUNCTION public.org_booking_expire_unpaid()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.org_bookings%ROWTYPE;
  n INTEGER := 0;
BEGIN
  FOR b IN
    SELECT * FROM public.org_bookings
    WHERE status = 'accepted' AND payment_status = 'none' AND COALESCE(price_cents, 0) > 0
      AND public.org_booking_start(org_bookings) < NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.org_bookings SET status = 'cancelled', cancelled_at = NOW(),
      org_note = COALESCE(org_note, 'Not paid before the booking time.')
    WHERE id = b.id;
    PERFORM public.booking_notify(b.customer_id, 'Booking cancelled: it wasn''t paid in time', b.listing_snapshot->>'title', b.id);
    PERFORM public.booking_notify(b.org_id, 'Unpaid booking released', b.listing_snapshot->>'title', b.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.org_booking_start(public.org_bookings) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_booking_start(public.org_bookings) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.org_booking_settle_payment(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_booking_settle_refund(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_booking_settle_payout(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_booking_expire_unpaid() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_booking_settle_payment(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_booking_settle_refund(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_booking_settle_payout(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_booking_expire_unpaid() TO service_role;
GRANT EXECUTE ON FUNCTION public.org_listing_spots_taken(UUID) TO service_role;
