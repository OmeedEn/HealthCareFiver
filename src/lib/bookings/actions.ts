'use server'

import { refresh } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { mfaGate } from '@/lib/auth/mfa'
import { isDemoMode } from '@/lib/demo/data'
import { BOOKING_TERMS_VERSION } from '@/lib/legal'
import { isStripeConfigured } from '@/lib/stripe/connect'
import { orgVerifyHref, safeNextPath } from '@/lib/onboarding/org-verify-later'
import { orgMustVerify } from '@/lib/onboarding/org-verify-later-server'
import { createBookingCheckout, tryBookingRefund } from './payments'

export type BookingActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; /** Hiring orgs that haven't verified: where to verify. */ verifyHref?: string }

/** The database explains refusals with a HINT code; turn it into plain words. */
const HINT_MESSAGES: Record<string, string> = {
  not_signed_in: 'Please sign in again.',
  listing_unavailable: 'This listing isn’t available anymore.',
  own_listing: 'You can’t book your own listing.',
  event_past: 'This event has already happened.',
  terms_required: 'Please accept the booking terms.',
  note_too_long: 'Keep your note under 2,000 characters.',
  contact_info:
    'For your protection, keep contact details on Sanus: remove phone numbers, email addresses, and links.',
  already_requested: 'You already have an open request for this. You can follow it in My bookings.',
  too_many_open: 'You have a lot of open requests. Wait for some answers before sending more.',
  event_full: 'Not enough spots left for that many people.',
  not_found: 'We couldn’t find that booking.',
  wrong_status: 'This booking changed in the meantime. Refresh to see the latest.',
  quote_required: 'This one needs a price: send a quote instead.',
  price_required: 'Enter a price for the quote.',
  time_required: 'Set the date and time: paid bookings need one so the customer can pay.',
  time_past: 'Pick a date and time in the future.',
  bad_length: 'Write a message (up to 4,000 characters).',
  rate_limited: 'You’re sending messages quickly. Wait a moment and try again.',
  org_verification_required: 'Verify your organization before booking. It takes about two minutes.',
}

function fail(error: { hint?: string | null; message?: string } | null): BookingActionResult {
  const hint = error?.hint ?? ''
  if (!HINT_MESSAGES[hint]) console.error('[bookings] action failed', error)
  return { ok: false, error: HINT_MESSAGES[hint] ?? 'Something went wrong. Please try again.' }
}

/** Signed-in client whose session finished two-factor sign-in, like every app page. */
async function session() {
  if (isDemoMode()) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || (await mfaGate(supabase)) !== 'ok') return null
  return supabase
}

const SESSION_EXPIRED: BookingActionResult = {
  ok: false,
  error: isDemoMode() ? 'Booking isn’t available in demo mode.' : 'Your session expired. Please sign in again.',
}

const uuid = z.string().uuid()
const isoOrNull = z.string().datetime({ offset: true }).nullable()

/**
 * Before the request dialog opens: an organization that hasn't verified yet
 * (Hiring orgs verify later) is sent to verification first, then back to
 * `returnTo`. Null = go ahead.
 */
export async function bookingVerifyHref(returnTo: string): Promise<string | null> {
  const supabase = await session()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await orgMustVerify(supabase, user.id))) return null
  return orgVerifyHref('book', safeNextPath(returnTo))
}

/** Customer: send a booking request (or registration) for a listing. */
export async function requestBooking(input: {
  listingId: string
  quantity: number
  requestedStart: string | null
  note: string
  termsVersion: string
}): Promise<BookingActionResult> {
  const parsed = z
    .object({
      listingId: uuid,
      quantity: z.number().int().min(1).max(50),
      requestedStart: isoOrNull,
      note: z.string().max(2000),
      termsVersion: z.string(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please check your answers and try again.' }
  if (parsed.data.termsVersion !== BOOKING_TERMS_VERSION) {
    return { ok: false, error: 'The booking terms were updated. Refresh the page and review them.' }
  }
  const supabase = await session()
  if (!supabase) return SESSION_EXPIRED
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user && (await orgMustVerify(supabase, user.id))) {
    return {
      ok: false,
      error: 'Verify your organization before booking. It takes about two minutes.',
      verifyHref: orgVerifyHref('book'),
    }
  }
  const { data, error } = await supabase.rpc('request_org_booking', {
    p_listing_id: parsed.data.listingId,
    p_quantity: parsed.data.quantity,
    p_requested_start: parsed.data.requestedStart,
    p_note: parsed.data.note,
    p_terms_version: parsed.data.termsVersion,
  })
  if (error) return fail(error)
  return { ok: true, id: data as string }
}

/** Organization: accept, quote, decline, or cancel. */
export async function respondToBooking(input: {
  bookingId: string
  action: 'accept' | 'quote' | 'decline' | 'cancel'
  priceDollars?: string
  scheduledStart?: string | null
  note?: string
}): Promise<BookingActionResult> {
  const parsed = z
    .object({
      bookingId: uuid,
      action: z.enum(['accept', 'quote', 'decline', 'cancel']),
      priceDollars: z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, 'price').optional(),
      scheduledStart: isoOrNull.optional(),
      note: z.string().max(2000).optional(),
    })
    .safeParse(input)
  if (!parsed.success) {
    const priceIssue = parsed.error.issues.some((i) => i.path[0] === 'priceDollars')
    return { ok: false, error: priceIssue ? 'Enter a price like 120 or 120.50.' : 'Please check your answers.' }
  }
  const d = parsed.data
  const supabase = await session()
  if (!supabase) return SESSION_EXPIRED
  const { error } = await supabase.rpc('respond_org_booking', {
    p_booking_id: d.bookingId,
    p_action: d.action,
    p_price_cents: d.priceDollars ? Math.round(Number(d.priceDollars) * 100) : null,
    p_scheduled_start: d.scheduledStart ?? null,
    p_note: d.note ?? null,
  })
  if (error) return fail(error)
  if (d.action === 'cancel') await tryBookingRefund(d.bookingId)
  refresh()
  return { ok: true }
}

/** Customer: accept a quote, or cancel. */
export async function customerBookingAction(bookingId: string, action: 'accept_quote' | 'cancel'): Promise<BookingActionResult> {
  if (!uuid.safeParse(bookingId).success || !['accept_quote', 'cancel'].includes(action)) {
    return { ok: false, error: 'Invalid request.' }
  }
  const supabase = await session()
  if (!supabase) return SESSION_EXPIRED
  const { error } = await supabase.rpc('customer_org_booking_action', { p_booking_id: bookingId, p_action: action })
  if (error) return fail(error)
  if (action === 'cancel') await tryBookingRefund(bookingId)
  refresh()
  return { ok: true }
}

/** Either side: post a message on the booking. */
export async function sendBookingMessage(bookingId: string, body: string): Promise<BookingActionResult> {
  if (!uuid.safeParse(bookingId).success) return { ok: false, error: 'Invalid request.' }
  const supabase = await session()
  if (!supabase) return SESSION_EXPIRED
  const { error } = await supabase.rpc('send_org_booking_message', { p_booking_id: bookingId, p_body: body })
  if (error) return fail(error)
  refresh()
  return { ok: true }
}

/** Customer: open Stripe Checkout to pay for an accepted booking. */
export async function payForBooking(bookingId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!uuid.safeParse(bookingId).success) return { ok: false, error: 'Invalid request.' }
  if (!isStripeConfigured()) return { ok: false, error: 'Payments open soon. We’ll let you know when you can pay.' }
  const supabase = await session()
  if (!supabase) return SESSION_EXPIRED as { ok: false; error: string }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return SESSION_EXPIRED as { ok: false; error: string }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${h.get('x-forwarded-proto') ?? 'https'}://${host}` : '')
  if (!appUrl) return { ok: false, error: 'Couldn’t start checkout. Please try again.' }
  try {
    return await createBookingCheckout(bookingId, user.id, appUrl)
  } catch (err) {
    console.error('[bookings] checkout failed', err)
    return { ok: false, error: 'Couldn’t start checkout. Please try again.' }
  }
}
