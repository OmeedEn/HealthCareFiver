import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { DEMO_CONTRACTOR, DEMO_PROVIDERS } from '@/lib/demo/data'
import { DEMO_LISTINGS } from '@/lib/listings/demo'
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

export type PublicProfileResult = {
  profile: PublicProfile
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
  viewerId: string | null
): Promise<PublicProfileResult | null> {
  if (!UUID_RE.test(id)) return null
  try {
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

    const all = await loadOfferings(supabase, id)
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

    return { profile, offerings, unpublished, isPublic, isOwner }
  } catch (err) {
    console.error('[pros] failed to load profile', err)
    return null
  }
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
    offerings: [],
    unpublished: [],
    isPublic: true,
    isOwner: false,
  }
}
