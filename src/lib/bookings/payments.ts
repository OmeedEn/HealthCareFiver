import 'server-only'

import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { bookingFeeCents } from './fees'
import { BOOKING_COLUMNS, bookingStart, needsPayment, type BookingRow } from './types'

/**
 * Money for organization bookings ("separate charges and transfers"):
 * the customer pays Sanus through Stripe Checkout, Sanus holds it, and the
 * daily cron transfers the price minus the fee to the organization 48 hours
 * after the booking. Every Stripe call uses an idempotency key derived from
 * the booking, so retries never double-charge, double-refund, or double-pay.
 */

export const ORG_BOOKING_CHECKOUT = 'org_booking'

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string }

async function loadBooking(id: string): Promise<(BookingRow & { stripe_checkout_session_id: string | null; stripe_payment_intent_id: string | null; stripe_charge_id: string | null }) | null> {
  const { data } = await createAdminClient()
    .from('org_bookings')
    .select(`${BOOKING_COLUMNS}, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id`)
    .eq('id', id)
    .maybeSingle()
  return data as never
}

/**
 * A Checkout Session for the customer's accepted booking. Reuses the open
 * session if there is one, so double clicks don't create two payments.
 */
export async function createBookingCheckout(bookingId: string, customerId: string, appUrl: string): Promise<CheckoutResult> {
  const b = await loadBooking(bookingId)
  if (!b || b.customer_id !== customerId) return { ok: false, error: 'We couldn’t find that booking.' }
  if (!needsPayment(b)) return { ok: false, error: 'This booking doesn’t need a payment right now. Refresh to see the latest.' }
  const start = bookingStart(b)
  if (!start) return { ok: false, error: 'The organization hasn’t set a date yet. Message them to confirm it, then pay.' }
  if (new Date(start).getTime() <= Date.now()) return { ok: false, error: 'This booking’s time has passed.' }

  const admin = createAdminClient()
  const { data: org } = await admin.from('profiles').select('stripe_connect_id, stripe_connect_onboarded').eq('id', b.org_id).single()
  if (!org?.stripe_connect_id || !org.stripe_connect_onboarded) {
    return { ok: false, error: 'This organization is finishing their payout setup. Please try again soon.' }
  }

  const stripe = getStripe()
  if (b.stripe_checkout_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(b.stripe_checkout_session_id).catch(() => null)
    if (existing?.status === 'open' && existing.url && existing.amount_total === b.price_cents) {
      return { ok: true, url: existing.url }
    }
  }

  const { data: customer } = await admin.auth.admin.getUserById(customerId)
  const base = appUrl.replace(/\/+$/, '')
  const s = b.listing_snapshot
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: customer.user?.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: b.price_cents!,
          product_data: {
            name: s.title,
            description: [s.org_name, b.kind === 'event' && b.quantity > 1 ? `${b.quantity} spots` : null].filter(Boolean).join(' · ') || undefined,
          },
        },
      },
    ],
    payment_intent_data: {
      transfer_group: b.id,
      description: `Sanus booking: ${s.title}`,
      metadata: { kind: ORG_BOOKING_CHECKOUT, bookingId: b.id },
    },
    metadata: { kind: ORG_BOOKING_CHECKOUT, bookingId: b.id },
    client_reference_id: b.id,
    // Checkout's minimum is 30 minutes; a minute of slack for clock skew.
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    success_url: `${base}/bookings/${b.id}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/bookings/${b.id}`,
  })
  await admin.from('org_bookings').update({ stripe_checkout_session_id: session.id }).eq('id', b.id).eq('payment_status', 'none')
  if (!session.url) return { ok: false, error: 'Couldn’t start checkout. Please try again.' }
  return { ok: true, url: session.url }
}

/**
 * Record a completed Checkout payment (from the webhook, or the success page
 * if the webhook is slow). Idempotent. If the booking can't take the money
 * (cancelled meanwhile, a second payment), it's refunded right away.
 */
export async function settleBookingCheckout(session: Stripe.Checkout.Session): Promise<'paid' | 'duplicate' | 'refunded' | 'ignored'> {
  const bookingId = session.metadata?.bookingId
  if (session.metadata?.kind !== ORG_BOOKING_CHECKOUT || !bookingId) return 'ignored'
  if (session.payment_status !== 'paid' || !session.payment_intent) return 'ignored'

  const stripe = getStripe()
  const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id
  const pi = await stripe.paymentIntents.retrieve(piId)
  const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge?.id ?? null)
  const amount = session.amount_total ?? pi.amount_received

  const { data, error } = await createAdminClient().rpc('org_booking_settle_payment', {
    p_booking_id: bookingId,
    p_session_id: session.id,
    p_payment_intent_id: piId,
    p_charge_id: chargeId,
    p_amount_cents: amount,
    p_fee_cents: bookingFeeCents(amount),
  })
  if (error) throw error
  if (data === 'refund') {
    await stripe.refunds.create(
      { payment_intent: piId, metadata: { bookingId, reason: 'booking_unavailable' } },
      { idempotencyKey: `org-booking-orphan-refund-${piId}` }
    )
    return 'refunded'
  }
  return data as 'paid' | 'duplicate'
}

/** Issue the refund a cancellation set up (payment_status = refund_pending). */
export async function processBookingRefund(bookingId: string): Promise<boolean> {
  const b = await loadBooking(bookingId)
  if (!b || b.payment_status !== 'refund_pending' || !b.stripe_payment_intent_id) return false
  const refund = await getStripe().refunds.create(
    {
      payment_intent: b.stripe_payment_intent_id,
      ...(b.refund_cents != null ? { amount: b.refund_cents } : {}),
      metadata: { bookingId: b.id },
    },
    { idempotencyKey: `org-booking-refund-${b.id}` }
  )
  const { error } = await createAdminClient().rpc('org_booking_settle_refund', { p_booking_id: b.id, p_refund_id: refund.id })
  if (error) throw error
  return true
}

/** Refund right after a cancel; if Stripe hiccups the cron retries it. */
export async function tryBookingRefund(bookingId: string): Promise<void> {
  try {
    await processBookingRefund(bookingId)
  } catch (err) {
    console.error('[bookings] refund failed; the daily job will retry', bookingId, err)
  }
}

export interface PayoutRunResult {
  paidOut: number
  waitingOnOrg: number
  refunded: number
  expired: number
  errors: number
}

/**
 * Daily job: release payouts that are due, retry pending refunds, and free
 * the spots of accepted bookings nobody paid for.
 */
export async function runBookingMoneyJobs(): Promise<PayoutRunResult> {
  const admin = createAdminClient()
  const stripe = getStripe()
  const out: PayoutRunResult = { paidOut: 0, waitingOnOrg: 0, refunded: 0, expired: 0, errors: 0 }

  const { data: due } = await admin
    .from('org_bookings')
    .select('id, org_id, amount_paid_cents, fee_cents, stripe_charge_id')
    .eq('payout_status', 'scheduled')
    .lte('payout_due_at', new Date().toISOString())
    .limit(200)
  for (const b of due ?? []) {
    try {
      const { data: org } = await admin.from('profiles').select('stripe_connect_id, stripe_connect_onboarded').eq('id', b.org_id).single()
      if (!org?.stripe_connect_id || !org.stripe_connect_onboarded) {
        out.waitingOnOrg++
        continue
      }
      const amount = (b.amount_paid_cents ?? 0) - (b.fee_cents ?? 0)
      let transferId = 'none'
      if (amount > 0) {
        const transfer = await stripe.transfers.create(
          {
            amount,
            currency: 'usd',
            destination: org.stripe_connect_id,
            transfer_group: b.id,
            // Ties the transfer to the charge, so it waits for those funds.
            ...(b.stripe_charge_id ? { source_transaction: b.stripe_charge_id } : {}),
            metadata: { bookingId: b.id },
          },
          { idempotencyKey: `org-booking-payout-${b.id}` }
        )
        transferId = transfer.id
      }
      const { error } = await admin.rpc('org_booking_settle_payout', { p_booking_id: b.id, p_transfer_id: transferId })
      if (error) throw error
      out.paidOut++
    } catch (err) {
      out.errors++
      console.error('[bookings] payout failed', b.id, err)
    }
  }

  const { data: pending } = await admin.from('org_bookings').select('id').eq('payment_status', 'refund_pending').limit(200)
  for (const b of pending ?? []) {
    try {
      if (await processBookingRefund(b.id)) out.refunded++
    } catch (err) {
      out.errors++
      console.error('[bookings] refund retry failed', b.id, err)
    }
  }

  const { data: expired, error } = await admin.rpc('org_booking_expire_unpaid')
  if (error) {
    out.errors++
    console.error('[bookings] expiring unpaid bookings failed', error)
  } else out.expired = (expired as number) ?? 0

  return out
}

/** A dispute opened on a booking's payment: hold the payout until it's resolved. */
export async function holdBookingPayoutForDispute(paymentIntentId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from('org_bookings')
    .update({ payout_status: 'on_hold' })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('payout_status', 'scheduled')
  if (error) throw error
}
