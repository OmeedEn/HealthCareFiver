import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ArrowLeft, Info, ShieldCheck } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { currentUser } from '@/lib/auth/roles'
import { getBookingDetail } from '@/lib/bookings/data'
import { money, when, type BookingRow } from '@/lib/bookings/types'
import { labelFor, EVENT_FORMATS, LISTING_FORMATS, ORG_EVENT_TYPES } from '@/lib/onboarding/organization'
import { BookingStatusBadge } from '@/components/bookings/booking-list'
import { BookingMessageForm, CustomerBookingActions, OrgBookingActions } from '@/components/bookings/booking-actions'

export const metadata: Metadata = { title: 'Booking — Sanus' }

type Props = { params: Promise<{ id: string }> }

/** One booking, for the customer or the organization: details, actions, messages. */
export default async function BookingPage({ params }: Props) {
  await connection()
  if (isDemoMode()) redirect('/bookings')
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?redirectTo=/bookings/${id}`)
  const detail = await getBookingDetail(id, user.id)
  if (!detail) notFound()

  const { booking: b, messages, side, names } = detail
  const s = b.listing_snapshot
  const counterpart = side === 'customer' ? (names.get(b.org_id) ?? s.org_name ?? 'The organization') : (names.get(b.customer_id) ?? 'Customer')
  const open = b.status !== 'declined' && b.status !== 'cancelled'

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
        <BookingStatusBadge status={b.status} side={side} />
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

      {open && (side === 'org' ? <OrgBookingActions booking={b} /> : <CustomerBookingActions booking={b} />)}

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
  const text =
    side === 'customer'
      ? {
          requested: 'The organization will accept, send a quote, or decline. We’ll notify you.',
          quoted: 'Review the quote. If it works for you, accept it to confirm.',
          accepted: 'You’re booked. Paying on Sanus comes next: we’ll ask you to pay before your booking, and the organization is paid after it happens.',
          declined: 'This request was declined. You can find other services and events in Find care.',
          cancelled: 'This booking was cancelled.',
        }[b.status]
      : {
          requested: b.price_cents == null ? 'This needs a price: send a quote, or decline.' : 'Accept it, send a different quote, or decline.',
          quoted: 'Waiting for the customer to accept your quote.',
          accepted: 'Booked. The customer will pay on Sanus before the booking, and you’re paid after it happens.',
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
