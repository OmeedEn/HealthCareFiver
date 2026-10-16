/** An org_bookings row as the app reads it. */
export type BookingStatus = 'requested' | 'quoted' | 'accepted' | 'paid' | 'completed' | 'declined' | 'cancelled'
export type PaymentStatus = 'none' | 'paid' | 'refund_pending' | 'refunded'
export type PayoutStatus = 'none' | 'scheduled' | 'on_hold' | 'paid' | 'cancelled'

export interface BookingSnapshot {
  title: string
  description: string | null
  format: string | null
  locations: string | null
  price_cents: number | null
  contact_for_pricing: boolean
  is_free: boolean
  reach_via: string | null
  event_type: string | null
  starts_at: string | null
  capacity: number | null
  offers_ceu: boolean | null
  org_name: string | null
}

export interface BookingRow {
  id: string
  listing_id: string | null
  org_id: string
  customer_id: string
  kind: 'service' | 'event'
  status: BookingStatus
  listing_snapshot: BookingSnapshot
  quantity: number
  requested_start: string | null
  note: string | null
  price_cents: number | null
  org_note: string | null
  scheduled_start: string | null
  terms_version: string
  terms_accepted_at: string
  responded_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  created_at: string
  updated_at: string
  payment_status: PaymentStatus
  amount_paid_cents: number | null
  fee_cents: number | null
  paid_at: string | null
  refund_cents: number | null
  refunded_at: string | null
  payout_status: PayoutStatus
  payout_due_at: string | null
  paid_out_at: string | null
}

export interface BookingMessage {
  id: string
  booking_id: string
  sender_id: string
  body: string
  created_at: string
}

export const BOOKING_COLUMNS =
  'id, listing_id, org_id, customer_id, kind, status, listing_snapshot, quantity, requested_start, note, price_cents, org_note, scheduled_start, terms_version, terms_accepted_at, responded_at, cancelled_at, cancelled_by, created_at, updated_at, payment_status, amount_paid_cents, fee_cents, paid_at, refund_cents, refunded_at, payout_status, payout_due_at, paid_out_at'

/** Accepted, costs money, and not paid yet. */
export function needsPayment(b: Pick<BookingRow, 'status' | 'price_cents' | 'payment_status'>): boolean {
  return b.status === 'accepted' && (b.price_cents ?? 0) > 0 && b.payment_status === 'none'
}

/** When the booking happens: the confirmed time, or the event start. */
export function bookingStart(b: Pick<BookingRow, 'kind' | 'scheduled_start' | 'listing_snapshot'>): string | null {
  return b.kind === 'event' ? b.listing_snapshot.starts_at : b.scheduled_start
}

/** Hours before the start that a customer can still cancel for a full refund. */
export const FREE_CANCEL_HOURS = 48

/** Last moment for a full refund, or null when there's no start time. */
export function freeCancelUntil(b: Pick<BookingRow, 'kind' | 'scheduled_start' | 'listing_snapshot'>): Date | null {
  const start = bookingStart(b)
  return start ? new Date(new Date(start).getTime() - FREE_CANCEL_HOURS * 3600_000) : null
}

/** Label for a booking, from each side's point of view. */
export function statusLabel(b: Pick<BookingRow, 'status' | 'price_cents' | 'payment_status'>, side: 'customer' | 'org'): string {
  switch (b.status) {
    case 'requested':
      return side === 'org' ? 'Needs your response' : 'Waiting for the organization'
    case 'quoted':
      return side === 'org' ? 'Quote sent' : 'Quote ready for you'
    case 'accepted':
      if (needsPayment(b)) return side === 'org' ? 'Awaiting payment' : 'Pay to confirm'
      return 'Booked'
    case 'paid':
      return 'Booked · paid'
    case 'completed':
      return 'Completed'
    case 'declined':
      return 'Declined'
    case 'cancelled':
      return b.payment_status === 'refunded' ? 'Cancelled · refunded' : b.payment_status === 'refund_pending' ? 'Cancelled · refund pending' : 'Cancelled'
  }
}

export function statusTone(b: Pick<BookingRow, 'status' | 'price_cents' | 'payment_status'>): 'green' | 'amber' | 'gray' | 'red' {
  if (needsPayment(b)) return 'amber'
  return b.status === 'accepted' || b.status === 'paid' || b.status === 'completed'
    ? 'green'
    : b.status === 'requested' || b.status === 'quoted'
      ? 'amber'
      : b.status === 'declined'
        ? 'red'
        : 'gray'
}

export function money(cents: number | null | undefined): string {
  if (cents == null) return 'To be quoted'
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

/** "Tue, Nov 5, 10:00 AM PST" in Pacific time (where Sanus launches). */
export function when(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  })
}
