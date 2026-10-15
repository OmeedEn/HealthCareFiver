/** An org_bookings row as the app reads it. */
export type BookingStatus = 'requested' | 'quoted' | 'accepted' | 'declined' | 'cancelled'

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
}

export interface BookingMessage {
  id: string
  booking_id: string
  sender_id: string
  body: string
  created_at: string
}

export const BOOKING_COLUMNS =
  'id, listing_id, org_id, customer_id, kind, status, listing_snapshot, quantity, requested_start, note, price_cents, org_note, scheduled_start, terms_version, terms_accepted_at, responded_at, cancelled_at, cancelled_by, created_at, updated_at'

/** Label per status, from each side's point of view. */
export function statusLabel(status: BookingStatus, side: 'customer' | 'org'): string {
  switch (status) {
    case 'requested':
      return side === 'org' ? 'Needs your response' : 'Waiting for the organization'
    case 'quoted':
      return side === 'org' ? 'Quote sent' : 'Quote ready for you'
    case 'accepted':
      return 'Accepted'
    case 'declined':
      return 'Declined'
    case 'cancelled':
      return 'Cancelled'
  }
}

export function statusTone(status: BookingStatus): 'green' | 'amber' | 'gray' | 'red' {
  return status === 'accepted' ? 'green' : status === 'requested' || status === 'quoted' ? 'amber' : status === 'declined' ? 'red' : 'gray'
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
