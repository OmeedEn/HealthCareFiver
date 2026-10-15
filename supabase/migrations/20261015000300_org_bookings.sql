-- 20261015000300_org_bookings.sql
-- Bookings phase 2: customers request an organization's service or event
-- through Sanus; the organization accepts, quotes, or declines. Payment comes
-- in a later phase (accepted -> paid), so there's no money here yet.
--
-- Everything goes through Sanus: bookings and their messages are only
-- written through the SECURITY DEFINER functions below (no direct
-- insert/update for users), and notes/messages may not contain phone
-- numbers, emails, or links.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_update';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.org_listings(id) ON DELETE SET NULL,
  org_id UUID NOT NULL REFERENCES public.facility_profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'event')),
  -- requested -> accepted | quoted | declined; quoted -> accepted | declined;
  -- requested | quoted | accepted -> cancelled. (paid/completed come later.)
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'quoted', 'accepted', 'declined', 'cancelled')),
  -- The listing as it was when requested (title, price, date, ...).
  listing_snapshot JSONB NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 50),
  requested_start TIMESTAMPTZ,              -- service: the customer's preferred time
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  -- Agreed total. NULL until known (services that need a quote).
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  org_note TEXT CHECK (org_note IS NULL OR char_length(org_note) <= 2000),
  scheduled_start TIMESTAMPTZ,              -- service: the time the org confirmed
  terms_version TEXT NOT NULL CHECK (char_length(terms_version) BETWEEN 1 AND 50),
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_bookings_org ON public.org_bookings (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_bookings_customer ON public.org_bookings (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_bookings_listing ON public.org_bookings (listing_id, status);

DROP TRIGGER IF EXISTS org_bookings_updated_at ON public.org_bookings;
CREATE TRIGGER org_bookings_updated_at
  BEFORE UPDATE ON public.org_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.org_booking_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.org_bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_booking_messages_booking ON public.org_booking_messages (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- Access: participants (customer, organization) and admins can read; nobody
-- writes directly — only through the functions below.
-- ---------------------------------------------------------------------------
ALTER TABLE public.org_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_booking_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.org_bookings FROM anon, authenticated;
REVOKE ALL ON public.org_booking_messages FROM anon, authenticated;
GRANT SELECT ON public.org_bookings TO authenticated;
GRANT SELECT ON public.org_booking_messages TO authenticated;
GRANT ALL ON public.org_bookings TO service_role;
GRANT ALL ON public.org_booking_messages TO service_role;

DROP POLICY IF EXISTS org_bookings_select ON public.org_bookings;
CREATE POLICY org_bookings_select ON public.org_bookings
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR org_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS org_booking_messages_select ON public.org_booking_messages;
CREATE POLICY org_booking_messages_select ON public.org_booking_messages
  FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.org_bookings b
      WHERE b.id = org_booking_messages.booking_id
        AND (b.customer_id = auth.uid() OR b.org_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Phone numbers, email addresses, and links. Bookings, payment and contact
-- stay on Sanus.
CREATE OR REPLACE FUNCTION public.booking_text_has_contact_info(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_text IS NOT NULL AND (
    p_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    OR p_text ~* '(https?://|www\.)'
    OR p_text ~ '(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}'
  );
$$;

-- plpgsql (not sql): the body isn't parsed until it runs, so it can use the
-- enum value added at the top of this same migration.
CREATE OR REPLACE FUNCTION public.booking_notify(
  p_user UUID, p_title TEXT, p_body TEXT, p_booking UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (p_user, 'booking_update', p_title, p_body, jsonb_build_object('booking_id', p_booking));
END;
$$;
REVOKE ALL ON FUNCTION public.booking_notify(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Customer: request a booking
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
  v_taken INTEGER;
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

  IF l.kind = 'event' AND l.capacity IS NOT NULL THEN
    SELECT COALESCE(sum(quantity), 0) INTO v_taken
      FROM public.org_bookings WHERE listing_id = l.id AND status = 'accepted';
    IF v_taken + v_qty > l.capacity THEN
      RAISE EXCEPTION 'Not enough spots left.' USING HINT = 'event_full';
    END IF;
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
  v_taken INTEGER;
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_title TEXT;
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

  IF p_action = 'accept' THEN
    IF b.status <> 'requested' THEN
      RAISE EXCEPTION 'This request was already answered.' USING HINT = 'wrong_status';
    END IF;
    IF b.price_cents IS NULL THEN
      RAISE EXCEPTION 'Send a quote with a price first.' USING HINT = 'quote_required';
    END IF;
    IF b.kind = 'event' AND b.listing_id IS NOT NULL THEN
      SELECT capacity INTO v_cap FROM public.org_listings WHERE id = b.listing_id;
      SELECT COALESCE(sum(quantity), 0) INTO v_taken
        FROM public.org_bookings WHERE listing_id = b.listing_id AND status = 'accepted';
      IF v_cap IS NOT NULL AND v_taken + b.quantity > v_cap THEN
        RAISE EXCEPTION 'Not enough spots left.' USING HINT = 'event_full';
      END IF;
    END IF;
    UPDATE public.org_bookings SET
      status = 'accepted',
      scheduled_start = CASE WHEN b.kind = 'service' THEN COALESCE(p_scheduled_start, b.requested_start) END,
      org_note = v_note, responded_at = NOW()
    WHERE id = b.id;
    PERFORM public.booking_notify(b.customer_id, 'Your booking was accepted', v_title, b.id);

  ELSIF p_action = 'quote' THEN
    IF b.status <> 'requested' THEN
      RAISE EXCEPTION 'This request was already answered.' USING HINT = 'wrong_status';
    END IF;
    IF p_price_cents IS NULL OR p_price_cents < 0 OR p_price_cents > 100000000 THEN
      RAISE EXCEPTION 'Enter a price for the quote.' USING HINT = 'price_required';
    END IF;
    UPDATE public.org_bookings SET
      status = 'quoted', price_cents = p_price_cents,
      scheduled_start = CASE WHEN b.kind = 'service' THEN COALESCE(p_scheduled_start, b.requested_start) END,
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
    IF b.status <> 'accepted' THEN
      RAISE EXCEPTION 'Only accepted bookings can be cancelled here.' USING HINT = 'wrong_status';
    END IF;
    UPDATE public.org_bookings SET
      status = 'cancelled', cancelled_at = NOW(), cancelled_by = v_uid, org_note = COALESCE(v_note, org_note)
    WHERE id = b.id;
    PERFORM public.booking_notify(b.customer_id, 'Your booking was cancelled', v_title, b.id);

  ELSE
    RAISE EXCEPTION 'Unknown action.' USING HINT = 'bad_action';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Customer: accept a quote or cancel
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
    IF b.status NOT IN ('requested', 'quoted', 'accepted') THEN
      RAISE EXCEPTION 'This booking can''t be cancelled.' USING HINT = 'wrong_status';
    END IF;
    UPDATE public.org_bookings SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = v_uid
    WHERE id = b.id;
    PERFORM public.booking_notify(b.org_id, 'Booking cancelled by the customer', v_title, b.id);
  ELSE
    RAISE EXCEPTION 'Unknown action.' USING HINT = 'bad_action';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Either side: message about a booking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_org_booking_message(
  p_booking_id UUID,
  p_body TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  b public.org_bookings%ROWTYPE;
  v_body TEXT := btrim(COALESCE(p_body, ''));
  v_id UUID;
BEGIN
  SELECT * INTO b FROM public.org_bookings WHERE id = p_booking_id;
  IF b.id IS NULL OR v_uid IS NULL OR v_uid NOT IN (b.customer_id, b.org_id) THEN
    RAISE EXCEPTION 'Booking not found.' USING HINT = 'not_found';
  END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Write a message (up to 4000 characters).' USING HINT = 'bad_length';
  END IF;
  IF public.booking_text_has_contact_info(v_body) THEN
    RAISE EXCEPTION 'Contact details aren''t allowed.' USING HINT = 'contact_info';
  END IF;
  IF (SELECT count(*) FROM public.org_booking_messages
       WHERE sender_id = v_uid AND created_at > NOW() - INTERVAL '1 minute') >= 10 THEN
    RAISE EXCEPTION 'Slow down a little.' USING HINT = 'rate_limited';
  END IF;

  INSERT INTO public.org_booking_messages (booking_id, sender_id, body)
  VALUES (b.id, v_uid, v_body) RETURNING id INTO v_id;

  PERFORM public.booking_notify(
    CASE WHEN v_uid = b.customer_id THEN b.org_id ELSE b.customer_id END,
    'New message about a booking', b.listing_snapshot->>'title', b.id
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_org_booking(UUID, INTEGER, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_org_booking(UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.customer_org_booking_action(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_org_booking_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_org_booking(UUID, INTEGER, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_org_booking(UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_org_booking_action(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_org_booking_message(UUID, TEXT) TO authenticated;
