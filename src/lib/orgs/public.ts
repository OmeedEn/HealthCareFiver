import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { DEMO_ORG_LISTINGS, DEMO_ORGS } from './demo'

/**
 * Public, browse-safe organization data for /orgs/[id], Find care and
 * Events. Bookings go through Sanus, so nothing here lets people reach an
 * organization directly: no phone, email, website, address, EIN, license
 * or verification internals. Columns are read through explicit allowlists,
 * and RLS already limits rows to approved organizations' published listings.
 */
export type PublicOrg = {
  id: string
  name: string
  orgType: string | null
  orgTypeOther: string | null
  description: string | null
  city: string | null
  state: string | null
  averageRating: number
  totalReviews: number
}

export type PublicOrgListing = {
  id: string
  orgId: string
  kind: 'service' | 'event'
  title: string
  description: string | null
  audiences: string[]
  format: string | null
  locations: string | null
  priceCents: number | null
  contactForPricing: boolean
  isFree: boolean
  reachVia: 'book' | 'inquiry' | null
  eventType: string | null
  startsAt: string | null
  capacity: number | null
  offersCeu: boolean | null
}

/** A listing plus the bits of its organization a card needs. */
export type PublicOrgListingWithOrg = PublicOrgListing & {
  org: Pick<PublicOrg, 'id' | 'name' | 'city' | 'state'>
}

const ORG_COLUMNS =
  'id, facility_name, org_type, org_type_other, description, city, state, average_rating, total_reviews'

const LISTING_COLUMNS =
  'id, facility_id, kind, title, description, audiences, format, locations, price_cents, contact_for_pricing, is_free, reach_via, event_type, starts_at, capacity, offers_ceu'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function toOrg(r: Row): PublicOrg {
  return {
    id: String(r.id),
    name: str(r.facility_name) ?? 'Organization',
    orgType: str(r.org_type),
    orgTypeOther: str(r.org_type_other),
    description: str(r.description),
    city: str(r.city),
    state: str(r.state),
    averageRating: num(r.average_rating) ?? 0,
    totalReviews: num(r.total_reviews) ?? 0,
  }
}

function toListing(r: Row): PublicOrgListing {
  return {
    id: String(r.id),
    orgId: String(r.facility_id),
    kind: r.kind === 'event' ? 'event' : 'service',
    title: str(r.title) ?? 'Untitled',
    description: str(r.description),
    audiences: Array.isArray(r.audiences) ? r.audiences.filter((a): a is string => typeof a === 'string') : [],
    format: str(r.format),
    locations: str(r.locations),
    priceCents: num(r.price_cents),
    contactForPricing: r.contact_for_pricing === true,
    isFree: r.is_free === true,
    reachVia: r.reach_via === 'book' || r.reach_via === 'inquiry' ? r.reach_via : null,
    eventType: str(r.event_type),
    startsAt: str(r.starts_at),
    capacity: num(r.capacity),
    offersCeu: typeof r.offers_ceu === 'boolean' ? r.offers_ceu : null,
  }
}

/** Events whose date has passed aren't bookable; undated ones stay. */
function isCurrent(l: PublicOrgListing, now = Date.now()): boolean {
  return l.kind !== 'event' || !l.startsAt || Date.parse(l.startsAt) >= now
}

function byStart(a: PublicOrgListing, b: PublicOrgListing): number {
  if (a.kind !== b.kind) return a.kind === 'event' ? -1 : 1
  return (a.startsAt ? Date.parse(a.startsAt) : Infinity) - (b.startsAt ? Date.parse(b.startsAt) : Infinity)
}

export type PublicOrgPage = {
  org: PublicOrg
  listings: PublicOrgListing[]
  /** The viewer is this organization (owner preview banner). */
  isOwner: boolean
  /** Approved by Sanus (an owner can preview before approval). */
  approved: boolean
}

/**
 * /orgs/[id]. Null when the organization isn't public (not approved) or
 * doesn't exist — RLS hides unapproved rows from everyone but the owner,
 * and the owner of an unapproved org gets a preview.
 */
export async function getPublicOrgPage(id: string, viewerId: string | null): Promise<PublicOrgPage | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const [{ data: org }, { data: rows }] = await Promise.all([
    supabase.from('facility_profiles').select(`${ORG_COLUMNS}, verification_status`).eq('id', id).maybeSingle(),
    supabase
      .from('org_listings')
      .select(LISTING_COLUMNS)
      .eq('facility_id', id)
      .eq('status', 'published'),
  ])
  if (!org) return null
  const isOwner = viewerId === id
  const approved = (org as Row).verification_status === 'approved'
  if (!approved && !isOwner) return null
  const listings = ((rows ?? []) as Row[]).map(toListing).filter((l) => isCurrent(l)).sort(byStart)
  return { org: toOrg(org as Row), listings, isOwner, approved }
}

/** Published listings across approved organizations (Find care, Events). */
export async function getPublicOrgListings(kind?: 'service' | 'event'): Promise<PublicOrgListingWithOrg[]> {
  try {
    const supabase = await createClient()
    let q = supabase
      .from('org_listings')
      .select(`${LISTING_COLUMNS}, facility_profiles!inner(id, facility_name, city, state, verification_status)`)
      .eq('status', 'published')
      .eq('facility_profiles.verification_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(200)
    if (kind) q = q.eq('kind', kind)
    const { data, error } = await q
    if (error || !data) return []
    return (data as Row[])
      .map((r) => {
        const fp = (Array.isArray(r.facility_profiles) ? r.facility_profiles[0] : r.facility_profiles) as Row
        return {
          ...toListing(r),
          org: { id: String(fp.id), name: str(fp.facility_name) ?? 'Organization', city: str(fp.city), state: str(fp.state) },
        }
      })
      .filter((l) => isCurrent(l))
      .sort(byStart)
  } catch {
    return []
  }
}

/* ───────────── Demo mode ───────────── */

export function getDemoOrgPage(id: string): PublicOrgPage | null {
  const org = DEMO_ORGS.find((o) => o.id === id)
  if (!org) return null
  return { org, listings: DEMO_ORG_LISTINGS.filter((l) => l.orgId === id).sort(byStart), isOwner: false, approved: true }
}

export function getDemoOrgListings(kind?: 'service' | 'event'): PublicOrgListingWithOrg[] {
  return DEMO_ORG_LISTINGS.filter((l) => !kind || l.kind === kind)
    .map((l) => {
      const o = DEMO_ORGS.find((x) => x.id === l.orgId)!
      return { ...l, org: { id: o.id, name: o.name, city: o.city, state: o.state } }
    })
    .sort(byStart)
}
