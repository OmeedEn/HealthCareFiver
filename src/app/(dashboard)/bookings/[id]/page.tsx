import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ArrowLeft, Info, ShieldCheck, Wallet } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { currentUser } from '@/lib/auth/roles'
import { getBookingDetail } from '@/lib/bookings/data'
import { freeCancelUntil, money, needsPayment, when, type BookingRow } from '@/lib/bookings/types'
import { bookingFeeCents, bookingFeePercent } from '@/lib/bookings/fees'
import { getStripe } from '@/lib/stripe/client'
import { isStripeConfigured } from '@/lib/stripe/connect'
import { settleBookingCheckout } from '@/lib/bookings/payments'
import { labelFor, EVENT_FORMATS, LISTING_FORMATS, ORG_EVENT_TYPES } from '@/lib/onboarding/organization'
import { BookingStatusBadge } from '@/components/bookings/booking-list'
import { BookingMessageForm, CustomerBookingActions, OrgBookingActions } from '@/components/bookings/booking-actions'

export const metadata: Metadata = { title: 'Booking — Sanus' }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/** One booking, for the customer or the organization: details, actions, messages. */
export default async function BookingPage({ params, searchParams }: Props) {
  await connection()
  if (isDemoMode()) redirect('/bookings')
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?redirectTo=/bookings/${id}`)
  let detail = await getBookingDetail(id, user.id)
  if (!detail) notFound()

  // Back from Stripe Checkout: record the payment now in case the webhook
  // hasn't arrived yet (it's idempotent either way).
  const sessionId = (await searchParams).session_id
  if (typeof sessionId === 'string' && detail.side === 'customer' && needsPayment(detail.booking) && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId)
      if (session.metadata?.bookingId === id) {
        await settleBookingCheckout(session)
        detail = (await getBookingDetail(id, user.id)) ?? detail
      }
    } catch (err) {
      console.error('[bookings] checkout return sync failed', err)
    }
  }

  const { booking: b, messages, side, names } = detail
  const s = b.listing_snapshot
  const counterpart = side === 'customer' ? (names.get(b.org_id) ?? s.org_name ?? 'The organization') : (names.get(b.customer_id) ?? 'Customer')
  const open = b.status !== 'declined' && b.status !== 'cancelled' && b.status !== 'completed'
  const cancelNote = side === 'customer' ? customerCancelNote(b) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={side === 'org' ? '/facility/bookings' : '/bookings'}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        {side === 'org' ? 'All bookings' : 'My bookings'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">{s.title}</h1>
          <p className="mt-1 text-sm text-[#62646a]">
            {side === 'customer' ? `With ${counterpart}` : `Requested by ${counterpart}`} · {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <BookingStatusBadge booking={b} side={side} />
      </div>

      <section className="rounded-2xl border border-[#e4e5e7] bg-white p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="What" value={b.kind === 'event' ? (labelFor(ORG_EVENT_TYPES, s.event_type) || 'Event') : 'Service'} />
          <Detail label="Format" value={[labelFor(b.kind === 'event' ? EVENT_FORMATS : LISTING_FORMATS, s.format), s.format === 'virtual' ? null : s.locations].filter(Boolean).join(' · ') || '—'} />
          <Detail label="When" value={whenLine(b)} />
          {b.kind === 'event' && <Detail label="Spots" value={String(b.quantity)} />}
          <Detail label={b.status === 'quoted' ? 'Quoted price' : 'Price'} value={money(b.price_cents)} />
        </dl>
        {b.note && <Note label={side === 'customer' ? 'Your note' : 'Customer’s note'} text={b.note} />}
        {b.org_note && <Note label={side === 'org' ? 'Your note' : `Note from ${counterpart}`} text={b.org_note} />}
      </section>

      <NextStep booking={b} side={side} />

      <MoneyPanel booking={b} side={side} />

      {open &&
        (side === 'org' ? (
          <OrgBookingActions booking={b} />
        ) : (
          <CustomerBookingActions booking={b} cancelNote={cancelNote} paymentsOpen={isStripeConfigured()} />
        ))}

      <section className="rounded-2xl border border-[#e4e5e7] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#404145]">Messages</h2>
        {messages.length === 0 ? (
          <p className="mt-2 text-sm text-[#62646a]">No messages yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {messages.map((m) => {
              const mine = m.sender_id === user.id
              return (
                <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-[#1dbf73] text-white' : 'bg-[#f3f4f5] text-[#404145]'}`}>
                    <p className="whitespace-pre-line">{m.body}</p>
                    <p className={`mt-1 text-[11px] ${mine ? 'text-white/80' : 'text-[#95979d]'}`}>
                      {mine ? 'You' : counterpart} · {when(m.created_at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-5">
          <BookingMessageForm bookingId={b.id} />
        </div>
        <p className="flex items-start gap-2 text-xs text-[#62646a]">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#1dbf73]" aria-hidden="true" />
          Keep contact details off messages. Booking, payment, and messages stay on Sanus so you’re protected.
        </p>
      </section>
    </div>
  )
}

function whenLine(b: BookingRow): string {
  if (b.kind === 'event') return when(b.listing_snapshot.starts_at) ?? 'Date to be announced'
  if (b.scheduled_start) return `${when(b.scheduled_start)} (confirmed)`
  if (b.requested_start) return `${when(b.requested_start)} (requested)`
  return 'Flexible'
}

function NextStep({ booking: b, side }: { booking: BookingRow; side: 'customer' | 'org' }) {
  const unpaid = needsPayment(b)
  const free = (b.price_cents ?? 0) === 0
  const text =
    side === 'customer'
      ? {
          requested: 'The organization will accept, send a quote, or decline. We’ll notify you.',
          quoted: 'Review the quote. If it works for you, accept it, then pay to confirm.',
          accepted: unpaid
            ? isStripeConfigured()
              ? 'Accepted. Pay on Sanus to confirm your spot. Sanus holds your payment until after your booking.'
              : 'Accepted. Payments on Sanus open soon; we’ll notify you when you can pay to confirm.'
            : free
              ? 'You’re booked. There’s nothing to pay.'
              : 'You’re booked.',
          paid: 'You’re booked and paid. Sanus holds your payment and pays the organization after your booking.',
          completed: 'This booking is complete.',
          declined: 'This request was declined. You can find other services and events in Find care.',
          cancelled: 'This booking was cancelled.',
        }[b.status]
      : {
          requested: b.price_cents == null ? 'This needs a price: send a quote, or decline.' : 'Accept it, send a different quote, or decline.',
          quoted: 'Waiting for the customer to accept your quote.',
          accepted: unpaid ? 'Accepted. Waiting for the customer to pay; we’ll notify you.' : 'Booked.',
          paid: 'Booked and paid. Your payout is sent 48 hours after the booking.',
          completed: 'Complete. Your payout was sent.',
          declined: 'You declined this request.',
          cancelled: 'This booking was cancelled.',
        }[b.status]
  return (
    <p className="flex items-start gap-2 rounded-xl border border-[#bcebd5] bg-[#f0faf5] p-4 text-sm text-[#0f4c3a]">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

const day = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
        timeZoneName: 'short',
      })
    : null

/** Cancelling now still gets a full refund (48+ hours before the start). */
function freeCancelNow(b: BookingRow): boolean {
  const until = freeCancelUntil(b)
  return !until || Date.now() <= until.getTime()
}

/** What cancelling does to the customer's money right now. */
function customerCancelNote(b: BookingRow): string | null {
  if (b.status !== 'paid') return null
  if (freeCancelNow(b)) return `You’ll get a full refund of ${money(b.amount_paid_cents)}.`
  return 'It’s less than 48 hours before your booking, so this payment isn’t refundable.'
}

/** Payment, refund, and payout details for each side. */
function MoneyPanel({ booking: b, side }: { booking: BookingRow; side: 'customer' | 'org' }) {
  const lines: [string, string][] = []
  const paid = b.amount_paid_cents
  const fee = b.fee_cents ?? (b.price_cents ? bookingFeeCents(b.price_cents) : 0)
  const until = freeCancelUntil(b)

  if (side === 'customer') {
    if (paid != null) lines.push(['Paid', `${money(paid)} on ${day(b.paid_at)}`])
    if (b.status === 'paid' && until) {
      lines.push(['Cancellation', freeCancelNow(b) ? `Free cancellation until ${day(until)}` : 'Not refundable (less than 48 hours before)'])
    } else if (needsPayment(b) && until) {
      lines.push(['Cancellation', `Free cancellation until ${day(until)}, then non-refundable`])
    }
    if (b.payment_status === 'refund_pending') lines.push(['Refund', `${money(b.refund_cents)} on its way`])
    if (b.payment_status === 'refunded') lines.push(['Refund', `${money(b.refund_cents)} refunded on ${day(b.refunded_at)}. It can take 5–10 days to reach your card.`])
  } else {
    if ((b.price_cents ?? 0) > 0 && ['accepted', 'paid', 'completed'].includes(b.status) && b.payout_status !== 'cancelled') {
      const pct = b.fee_cents != null && paid ? Math.round((b.fee_cents / paid) * 1000) / 10 : bookingFeePercent()
      const total = paid ?? b.price_cents!
      lines.push(['Your payout', `${money(total - fee)} (${money(total)} minus the ${pct}% Sanus fee)`])
    }
    if (b.payout_status === 'scheduled') lines.push(['Payout date', b.payout_due_at ? `Around ${day(b.payout_due_at)}` : 'After the booking'])
    if (b.payout_status === 'on_hold') lines.push(['Payout', 'On hold: the customer disputed the payment. We’ll be in touch.'])
    if (b.payout_status === 'paid') lines.push(['Payout', `Sent on ${day(b.paid_out_at)}`])
    if (b.payout_status === 'cancelled') lines.push(['Payout', 'None: the customer was refunded'])
  }
  if (!lines.length) return null
  return (
    <section className="rounded-2xl border border-[#e4e5e7] bg-white p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[#404145]">
        <Wallet className="size-5 text-[#1dbf73]" aria-hidden="true" />
        Payment
      </h2>
      <dl className="mt-3 space-y-2 text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-[#62646a]">{k}</dt>
            <dd className="font-medium text-[#404145] sm:text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#95979d]">{label}</dt>
      <dd className="mt-1 font-medium text-[#404145]">{value}</dd>
    </div>
  )
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-5 rounded-xl bg-[#fafafa] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#95979d]">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-[#404145]">{text}</p>
    </div>
  )
}
