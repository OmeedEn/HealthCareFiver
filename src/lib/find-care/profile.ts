import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEMO_AVAILABILITY,
  DEMO_CONTRACTOR,
  DEMO_FACILITY,
  DEMO_PROVIDERS,
  DEMO_REVIEWS,
} from '@/lib/demo/data'
import { DEMO_LISTINGS } from '@/lib/listings/demo'
import { getHiddenDemoIds } from '@/lib/demo/hide'
import {
  LISTING_BASE_COLUMNS,
  LISTING_V3_COLUMNS,
  normalizeListingRow,
  type ListingRow,
} from '@/lib/listings/offering'
import {
  toPublicListing,
  type PublicListing,
} from '@/components/listings/listing-card'
import { PROFILE_NAME_SELECT, type ProfileWithNames } from '@/lib/profile-name'
import { RATE_COLUMNS, type ProfessionalRate } from '@/lib/rates/types'
import { getComplianceById, getReadClient } from './providers'
import {
  CONTRACTOR_TYPE_BADGES,
  PROFESSIONAL_CATEGORY_LABELS,
  type ProfessionalCategory,
} from './types'

/**
 * Public profile at /pros/[id].
 *
 * Public-safe shape only: never license numbers, NPI, documents, disclosures,
 * phone, email, zip, or verification internals. Columns are read through an
 * explicit allowlist (like ./providers.ts) and mapped to this type before
 * anything leaves the server.
 */
export type PublicProfile = {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  credential: string | null
  headline: string | null
  bio: string | null
  categoryLabel: string | null
  otherProfession: string | null
  specialties: string[]
  languages: string[]
  city: string | null
  state: string | null
  telehealthStates: string[]
  yearsOfExperience: number | null
  average_rating: number
  total_reviews: number
  verified: boolean
  insured: boolean
}

export type PublicReview = {
  id: string
  rating: number
  title: string | null
  content: string | null
  created_at: string | null
  /** "Northline Medical Center", "Maria G." — never an email. */
  reviewer: string
}

export type PublicPhoto = {
  id: string
  url: string
  caption: string | null
}

/** One recurring weekly window, e.g. Mon 08:00–17:00. */
export type AvailabilityWindow = {
  day: number
  start: string | null
  end: string | null
}

export type AvailabilitySummary = {
  /** contractor_profiles.is_available; null if unknown. */
  accepting: boolean | null
  willingToTravel: boolean
  travelRadiusMiles: number | null
  weekly: AvailabilityWindow[]
}

export type PublicProfileResult = {
  profile: PublicProfile
  /**
   * Active rates (professional_rates). null when the table isn't available
   * yet (migration not applied): the page hides the section.
   */
  rates: ProfessionalRate[] | null
  reviews: PublicReview[]
  photos: PublicPhoto[]
  availability: AvailabilitySummary
  /** Published, publishable listings — what clients see. */
  offerings: PublicListing[]
  /** Owner preview only: their listings that aren't public yet. */
  unpublished: Pick<ListingRow, 'id' | 'title' | 'status'>[]
  /** True when anyone can see this profile (provider can go live). */
  isPublic: boolean
  isOwner: boolean
}

const PUBLIC_PROFILE_COLUMNS = [
  'id',
  'first_name',
  'last_name',
  'contractor_type',
  'professional_category',
  'specialties',
  'headline',
  'bio',
  'city',
  'state',
  'languages',
  'years_of_experience',
  'average_rating',
  'total_reviews',
  // used server-side for the go-live decision only; never returned
  'verification_status',
  'contractor_agreement_accepted_at',
].join(', ')

const V3_PROFILE_COLUMNS = 'other_profession, telehealth_states'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function asCategory(v: unknown): ProfessionalCategory | null {
  return v === 'clinical' || v === 'allied' || v === 'consultant' || v === 'educator'
    ? v
    : null
}

function isLiveStatus(v: unknown): boolean {
  return v === 'approved' || v === 'insurance_pending'
}

async function loadRates(
  supabase: SupabaseClient,
  contractorId: string
): Promise<ProfessionalRate[] | null> {
  const { data, error } = await supabase
    .from('professional_rates')
    .select(RATE_COLUMNS)
    .eq('contractor_id', contractorId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error || !data) return null
  return data as unknown as ProfessionalRate[]
}

async function loadPhotos(
  supabase: SupabaseClient,
  contractorId: string
): Promise<PublicPhoto[]> {
  const { data, error } = await supabase
    .from('professional_photos')
    .select('id, url, caption')
    .eq('contractor_id', contractorId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(12)
  if (error || !data) return []
  return (data as { id: string; url: string; caption: string | null }[]).filter(
    (p) => typeof p.url === 'string' && p.url.startsWith('https://')
  )
}

/** "Maria G." for people, the organization name for orgs. */
function reviewerLabel(p: ProfileWithNames | undefined): string {
  if (!p) return 'Sanus member'
  const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  const org = one(p.facility_profiles)?.facility_name
  if (org) return org
  const person = one(p.client_profiles) ?? one(p.contractor_profiles)
  if (person?.first_name) {
    const initial = person.last_name?.trim()[0]
    return initial ? `${person.first_name} ${initial.toUpperCase()}.` : person.first_name
  }
  return 'Sanus member'
}

async function loadReviews(
  supabase: SupabaseClient,
  contractorId: string
): Promise<PublicReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, title, content, created_at, reviewer_id')
    .eq('reviewee_id', contractorId)
    .eq('is_visible', true)
    .eq('admin_hidden', false)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error || !data) return []
  const rows = data as {
    id: string
    rating: number
    title: string | null
    content: string | null
    created_at: string | null
    reviewer_id: string
  }[]
  const ids = [...new Set(rows.map((r) => r.reviewer_id))]
  const names = new Map<string, ProfileWithNames>()
  if (ids.length > 0) {
    const { data: people } = await supabase
      .from('profiles')
      .select(PROFILE_NAME_SELECT)
      .in('id', ids)
    for (const p of (people ?? []) as unknown as ProfileWithNames[]) names.set(p.id, p)
  }
  return rows.map((r) => ({
    id: r.id,
    rating: Math.max(1, Math.min(5, Number(r.rating) || 0)),
    title: r.title,
    content: r.content,
    created_at: r.created_at,
    reviewer: reviewerLabel(names.get(r.reviewer_id)),
  }))
}

async function loadAvailability(
  supabase: SupabaseClient,
  contractorId: string
): Promise<AvailabilitySummary> {
  const [{ data: prefs, error: prefsError }, { data: slots, error: slotsError }] =
    await Promise.all([
      supabase
        .from('contractor_profiles')
        .select('is_available, willing_to_travel, travel_radius_miles')
        .eq('id', contractorId)
        .maybeSingle(),
      supabase
        .from('contractor_availability')
        .select('day_of_week, start_time, end_time')
        .eq('contractor_id', contractorId)
        .eq('is_blocked', false)
        .not('day_of_week', 'is', null)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true }),
    ])
  const pr = (prefsError ? null : prefs) as Record<string, unknown> | null
  const weekly = slotsError
    ? []
    : ((slots ?? []) as { day_of_week: number; start_time: string | null; end_time: string | null }[])
        .filter((s) => Number.isInteger(s.day_of_week) && s.day_of_week >= 0 && s.day_of_week <= 6)
        .map((s) => ({ day: s.day_of_week, start: s.start_time, end: s.end_time }))
  return {
    accepting: typeof pr?.is_available === 'boolean' ? pr.is_available : null,
    willingToTravel: pr?.willing_to_travel === true,
    travelRadiusMiles: num(pr?.travel_radius_miles),
    weekly,
  }
}

const NO_AVAILABILITY: AvailabilitySummary = {
  accepting: null,
  willingToTravel: false,
  travelRadiusMiles: null,
  weekly: [],
}

async function loadOfferings(
  supabase: SupabaseClient,
  contractorId: string
): Promise<ListingRow[]> {
  const run = (cols: string) =>
    supabase
      .from('professional_offerings')
      .select(cols)
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: true })
  let { data, error } = await run(`${LISTING_BASE_COLUMNS}, ${LISTING_V3_COLUMNS}`)
  if (error) ({ data, error } = await run(LISTING_BASE_COLUMNS))
  if (error || !data) return []
  return (data as unknown as Record<string, unknown>[]).map(normalizeListingRow)
}

/**
 * Load /pros/[id]. Returns null (→ 404) unless the provider can go live, or
 * the viewer is the provider themself (owner preview).
 */
export async function getPublicProfile(
  id: string,
  viewerId: string | null,
  /** false: visibility check only (skips rates, reviews, photos, availability). */
  opts: { details?: boolean } = {}
): Promise<PublicProfileResult | null> {
  const details = opts.details !== false
  if (!UUID_RE.test(id)) return null
  try {
    // HIDE_DEMO_DATA: seeded demo accounts 404.
    if ((await getHiddenDemoIds()).has(id)) return null
    const supabase = await getReadClient()

    const [{ data: row, error }, { data: v3, error: v3Error }, { data: account }] =
      await Promise.all([
        supabase
          .from('contractor_profiles')
          .select(PUBLIC_PROFILE_COLUMNS)
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('contractor_profiles')
          .select(V3_PROFILE_COLUMNS)
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('avatar_url, is_active, role')
          .eq('id', id)
          .maybeSingle(),
      ])
    if (error || !row) return null
    const r = row as unknown as Record<string, unknown>
    const ext = (v3Error ? null : v3) as Record<string, unknown> | null

    const isOwner = viewerId != null && viewerId === id
    const activeContractor =
      account?.role === 'contractor' && account?.is_active !== false

    // Authoritative: SQL can_go_live() (approved/insurance_pending + agreement
    // + no compliance hold). Fallback if the RPC is unavailable.
    const compliance = (await getComplianceById(supabase, [id])).get(id)
    let canGoLive: boolean
    const { data: rpc, error: rpcError } = await supabase.rpc('can_go_live', {
      p_user_id: id,
    })
    if (!rpcError && typeof rpc === 'boolean') {
      canGoLive = rpc
    } else {
      canGoLive =
        isLiveStatus(r.verification_status) &&
        r.contractor_agreement_accepted_at != null &&
        !compliance?.hold
    }
    const isPublic = activeContractor && canGoLive
    if (!isPublic && !isOwner) return null

    const insured = compliance?.insured ?? false
    const category = asCategory(r.professional_category)
    const type = typeof r.contractor_type === 'string' ? r.contractor_type : null

    const profile: PublicProfile = {
      id,
      first_name: (r.first_name as string | null) ?? '',
      last_name: (r.last_name as string | null) ?? '',
      avatar_url: (account?.avatar_url as string | null) ?? null,
      credential: (type && CONTRACTOR_TYPE_BADGES[type]) || null,
      headline: (r.headline as string | null) ?? null,
      bio: (r.bio as string | null) ?? null,
      categoryLabel: category ? PROFESSIONAL_CATEGORY_LABELS[category] : null,
      otherProfession:
        typeof ext?.other_profession === 'string' && ext.other_profession.trim()
          ? ext.other_profession.trim()
          : null,
      specialties: strings(r.specialties),
      languages: strings(r.languages),
      city: (r.city as string | null) ?? null,
      state: (r.state as string | null) ?? null,
      telehealthStates: strings(ext?.telehealth_states),
      yearsOfExperience: num(r.years_of_experience),
      average_rating: num(r.average_rating) ?? 0,
      total_reviews: num(r.total_reviews) ?? 0,
      verified: isLiveStatus(r.verification_status),
      insured,
    }

    const [all, rates, reviews, photos, availability] = await Promise.all([
      loadOfferings(supabase, id),
      details ? loadRates(supabase, id) : Promise.resolve(null),
      details ? loadReviews(supabase, id) : Promise.resolve([]),
      details ? loadPhotos(supabase, id) : Promise.resolve([]),
      details ? loadAvailability(supabase, id) : Promise.resolve(NO_AVAILABILITY),
    ])
    // Mirrors SQL can_publish_offering(): published AND provider can go live
    // AND (no malpractice needed OR insured).
    const offerings = all
      .filter(
        (o) =>
          o.status === 'published' && canGoLive && (!o.requires_malpractice || insured)
      )
      .map(toPublicListing)
    const unpublished = isOwner
      ? all
          .filter((o) => !offerings.some((p) => p.id === o.id))
          .map((o) => ({ id: o.id, title: o.title, status: o.status }))
      : []

    return {
      profile,
      rates,
      reviews,
      photos,
      availability,
      offerings,
      unpublished,
      isPublic,
      isOwner,
    }
  } catch (err) {
    console.error('[pros] failed to load profile', err)
    return null
  }
}

const DEMO_RATES: ProfessionalRate[] = [
  {
    id: 'demo-rate-1',
    contractor_id: DEMO_CONTRACTOR.id,
    label: 'Private-duty nursing',
    description: 'In-home skilled nursing, post-op and recovery care.',
    unit: 'hour',
    unit_label: null,
    duration_minutes: null,
    amount_cents: 8500,
    amount_max_cents: 11000,
    on_request: false,
    sort_order: 0,
    is_active: true,
  },
  {
    id: 'demo-rate-2',
    contractor_id: DEMO_CONTRACTOR.id,
    label: 'Virtual care consult',
    description: null,
    unit: 'session',
    unit_label: null,
    duration_minutes: 45,
    amount_cents: 12000,
    amount_max_cents: null,
    on_request: false,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'demo-rate-3',
    contractor_id: DEMO_CONTRACTOR.id,
    label: 'Staff training workshops',
    description: 'Half-day or full-day sessions for clinical teams.',
    unit: 'custom',
    unit_label: 'per workshop',
    duration_minutes: null,
    amount_cents: null,
    amount_max_cents: null,
    on_request: true,
    sort_order: 2,
    is_active: true,
  },
]

function demoReviews(id: string): PublicReview[] {
  return DEMO_REVIEWS.filter((r) => r.reviewee_id === id).map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    content: r.content,
    created_at: r.created_at,
    reviewer: r.reviewer_id === DEMO_FACILITY.id ? DEMO_FACILITY.facility_name : 'Verified organization',
  }))
}

/** Demo mode (no Supabase): fictional providers + the demo contractor. */
export function getDemoPublicProfile(id: string): PublicProfileResult | null {
  if (id === DEMO_CONTRACTOR.id) {
    const c = DEMO_CONTRACTOR
    const offerings = DEMO_LISTINGS.filter((l) => l.status === 'published').map(
      toPublicListing
    )
    return {
      profile: {
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        avatar_url: null,
        credential: CONTRACTOR_TYPE_BADGES[c.contractor_type] ?? null,
        headline: c.headline,
        bio: c.bio,
        categoryLabel: PROFESSIONAL_CATEGORY_LABELS.clinical,
        otherProfession: null,
        specialties: c.specialties,
        languages: ['English', 'Spanish'],
        city: c.city,
        state: c.state,
        telehealthStates: ['CA', 'NV'],
        yearsOfExperience: c.years_of_experience,
        average_rating: c.average_rating,
        total_reviews: c.total_reviews,
        verified: true,
        insured: false,
      },
      rates: DEMO_RATES,
      reviews: demoReviews(c.id),
      photos: [],
      availability: {
        accepting: c.is_available,
        willingToTravel: c.willing_to_travel,
        travelRadiusMiles: c.travel_radius_miles,
        weekly: DEMO_AVAILABILITY.filter((a) => a.contractor_id === c.id).map((a) => ({
          day: a.day_of_week,
          start: a.start_time,
          end: a.end_time,
        })),
      },
      offerings,
      unpublished: DEMO_LISTINGS.filter((l) => l.status !== 'published').map(
        (l) => ({ id: l.id, title: l.title, status: l.status })
      ),
      isPublic: true,
      isOwner: true,
    }
  }
  const p = DEMO_PROVIDERS.find((x) => x.id === id)
  if (!p) return null
  return {
    profile: {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: null,
      credential: p.credential,
      headline: p.headline,
      bio: null,
      categoryLabel:
        PROFESSIONAL_CATEGORY_LABELS[p.contractor_type === 'other' ? 'allied' : 'clinical'],
      otherProfession: null,
      specialties: p.specialties,
      languages: ['English'],
      city: p.city,
      state: p.state,
      telehealthStates: p.session_types.includes('virtual') ? [p.state] : [],
      yearsOfExperience: p.years_of_experience,
      average_rating: p.average_rating,
      total_reviews: p.total_reviews,
      verified: true,
      insured: p.id === 'prov-1' || p.id === 'prov-3',
    },
    rates: [],
    reviews: [],
    photos: [],
    availability: { ...NO_AVAILABILITY, accepting: p.is_available },
    offerings: [],
    unpublished: [],
    isPublic: true,
    isOwner: false,
  }
}
