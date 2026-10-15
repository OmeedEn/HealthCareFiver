import { EMPTY_EVENT } from './sections/event-form'
import { EMPTY_SERVICE } from './sections/service-form'
import { eventSchema, serviceSchema, toCents, type EventDraft, type ServiceDraft, type YesNo } from './shared'

/** An org_listings row, as selected by the dashboard. */
export interface ListingRow {
  id: string
  kind: 'service' | 'event'
  status: string
  title: string
  description: string | null
  audiences: string[]
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
  review_notes: string | null
}

const dollars = (cents: number | null) => (cents == null ? '' : String(cents / 100))

/**
 * `<input type="datetime-local">` value for an ISO timestamp, in the
 * browser's time zone. Call on the client only.
 */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * ISO timestamp for a datetime-local value, read in the browser's time zone.
 * Convert before sending: the server runs in UTC, so a bare "10:00" would
 * be stored as 10:00 UTC.
 */
export function localInputToIso(local: string): string {
  return local ? new Date(local).toISOString() : ''
}

export function rowToService(r: ListingRow): ServiceDraft {
  return {
    ...EMPTY_SERVICE,
    title: r.title ?? '',
    description: r.description ?? '',
    audiences: r.audiences ?? [],
    format: r.format ?? '',
    locations: r.locations ?? '',
    price: dollars(r.price_cents),
    contact_for_pricing: r.contact_for_pricing,
    reach_via: r.reach_via ?? '',
  }
}

/** Call on the client (starts_at is shown in the browser's time zone). */
export function rowToEvent(r: ListingRow): EventDraft {
  return {
    ...EMPTY_EVENT,
    event_type: r.event_type ?? '',
    title: r.title ?? '',
    description: r.description ?? '',
    // A saved draft with no date was either "set up later" or not answered yet.
    date_later: !r.starts_at && r.format != null,
    starts_at: isoToLocalInput(r.starts_at),
    format: r.format ?? '',
    locations: r.locations ?? '',
    capacity: r.capacity == null ? '' : String(r.capacity),
    is_free: r.is_free,
    price: dollars(r.price_cents),
    offers_ceu: (r.offers_ceu == null ? '' : r.offers_ceu ? 'yes' : 'no') as YesNo,
    audiences: r.audiences ?? [],
  }
}

/** True when the row passes the same checks as a full save. */
export function listingIsComplete(r: ListingRow): boolean {
  if (r.kind === 'service') return serviceSchema.safeParse(rowToService(r)).success
  // Server-side: keep the stored ISO time rather than converting to local.
  const e = { ...rowToEvent(r), starts_at: r.starts_at ?? '', date_later: !r.starts_at }
  return eventSchema.safeParse(e).success
}

/**
 * org_listings columns for a partial draft. Only the given keys are mapped;
 * paired fields (price with its "contact"/"free" toggle, date with "later")
 * travel together because they're asked on the same screen.
 */
export function draftToColumns(
  kind: 'service' | 'event',
  d: Partial<ServiceDraft & EventDraft>,
  keys: string[]
): Record<string, unknown> {
  const has = (k: string) => keys.includes(k)
  const row: Record<string, unknown> = {}
  if (has('title')) row.title = d.title
  if (has('description')) row.description = d.description || null
  if (has('audiences')) row.audiences = d.audiences ?? []
  if (has('format')) row.format = d.format || null
  if (has('locations') || has('format')) row.locations = d.format === 'virtual' ? null : d.locations || null
  if (kind === 'service') {
    if (has('price')) {
      row.contact_for_pricing = !!d.contact_for_pricing
      row.price_cents = d.contact_for_pricing ? null : toCents(d.price ?? '')
    }
    if (has('reach_via')) row.reach_via = d.reach_via || null
  } else {
    if (has('event_type')) row.event_type = d.event_type || null
    if (has('starts_at')) row.starts_at = d.date_later || !d.starts_at ? null : d.starts_at
    if (has('capacity')) row.capacity = d.capacity ? Number(d.capacity) : null
    if (has('price')) {
      row.is_free = !!d.is_free
      row.price_cents = d.is_free ? null : toCents(d.price ?? '')
    }
    if (has('offers_ceu')) row.offers_ceu = d.offers_ceu ? d.offers_ceu === 'yes' : null
  }
  return row
}
