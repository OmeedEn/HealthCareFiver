import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { DEMO_PROVIDERS } from '@/lib/demo/data'
import {
  CONTRACTOR_TYPE_BADGES,
  PROFESSIONAL_CATEGORY_LABELS,
  type ProfessionalCategory,
  type PublicProvider,
} from './types'

const MAX_RESULTS = 200

/** verification_status values that can go live (with agreement + no hold). */
export const LIVE_STATUSES = ['approved', 'insurance_pending'] as const

type Compliance = { hold: boolean; insured: boolean }

/**
 * compliance_hold_reason / insured_verified_at per contractor (v3 columns).
 * Only booleans leave this function. On error (columns not migrated yet)
 * everyone is treated as no hold / not insured.
 */
export async function getComplianceById(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, Compliance>> {
  const out = new Map<string, Compliance>()
  if (ids.length === 0) return out
  const { data, error } = await supabase
    .from('contractor_profiles')
    .select('id, compliance_hold_reason, insured_verified_at')
    .in('id', ids)
  if (error || !data) return out
  for (const r of data as Record<string, unknown>[]) {
    out.set(r.id as string, {
      hold: typeof r.compliance_hold_reason === 'string' && r.compliance_hold_reason.length > 0,
      insured: r.insured_verified_at != null,
    })
  }
  return out
}

/**
 * Explicit allowlist of public-safe contractor_profiles columns. Anything
 * not listed here (npi_number, state_license_number, license_state,
 * zip_code, verification_* internals, etc.) is never fetched.
 */
const PUBLIC_CONTRACTOR_COLUMNS = [
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
  'hourly_rate_min',
  'hourly_rate_max',
  'average_rating',
  'total_reviews',
  'is_available',
].join(', ')

type ContractorRow = {
  id: string
  first_name: string | null
  last_name: string | null
  contractor_type: string | null
  professional_category: string | null
  specialties: string[] | null
  headline: string | null
  bio: string | null
  city: string | null
  state: string | null
  hourly_rate_min: number | string | null
  hourly_rate_max: number | string | null
  average_rating: number | string | null
  total_reviews: number | null
  is_available: boolean | null
}

function toNumber(v: number | string | null): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function asCategory(v: string | null): ProfessionalCategory | null {
  return v === 'clinical' ||
    v === 'allied' ||
    v === 'consultant' ||
    v === 'educator'
    ? v
    : null
}

function mapRow(
  row: ContractorRow,
  avatarUrl: string | null,
  insured = false
): PublicProvider {
  const category = asCategory(row.professional_category)
  const type = row.contractor_type ?? 'other'
  const specialties = row.specialties ?? []
  const categoryLabel = category ? PROFESSIONAL_CATEGORY_LABELS[category] : null

  return {
    id: row.id,
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    credential:
      CONTRACTOR_TYPE_BADGES[type] ??
      (category === 'consultant'
        ? 'Consultant'
        : category === 'educator'
          ? 'Educator'
          : 'Verified'),
    contractor_type: type,
    professional_category: category,
    specialty: specialties[0] ?? categoryLabel ?? 'Health professional',
    specialties,
    headline: row.headline ?? '',
    bio: row.bio,
    avatar_url: avatarUrl,
    hourly_rate_min: toNumber(row.hourly_rate_min),
    hourly_rate_max: toNumber(row.hourly_rate_max),
    city: row.city,
    state: row.state,
    average_rating: toNumber(row.average_rating) ?? 0,
    total_reviews: row.total_reviews ?? 0,
    is_available: row.is_available ?? true,
    session_types: [],
    insured,
  }
}

/**
 * Demo-mode providers (no Supabase configured). Clearly fictional; only
 * ever rendered when isDemoMode() is true.
 */
export function getDemoProviders(): PublicProvider[] {
  return DEMO_PROVIDERS.map((p): PublicProvider => ({
    ...p,
    professional_category: p.contractor_type === 'other' ? 'allied' : 'clinical',
    bio: null,
    avatar_url: null,
    // Fictional: a couple of demo providers show the Insured badge.
    insured: p.id === 'prov-1' || p.id === 'prov-3',
  }))
}

/**
 * Public anon reads of profiles / contractor_profiles are blocked by RLS
 * (policies are TO authenticated). For a logged-out marketplace page we
 * therefore read server-side with the admin client when available, but
 * ONLY the allowlisted columns above, filtered to "go live" professionals
 * (see src/lib/auth/can-go-live.ts). Nothing but the mapped PublicProvider
 * shape is returned to the client. Without a service-role key we fall back
 * to the cookie-bound server client, where RLS decides visibility (anon
 * visitors then see the honest empty state).
 */
export async function getReadClient(): Promise<SupabaseClient> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createAdminClient()
  }
  return (await createClient()) as unknown as SupabaseClient
}

export async function getLiveProviders(): Promise<PublicProvider[]> {
  try {
    const supabase = await getReadClient()

    // 1. "Live" professionals: admin-approved (incl. 'insurance_pending',
    //    the malpractice grace period) AND contractor agreement accepted AND
    //    no compliance hold (mirrors SQL can_go_live; see
    //    src/lib/auth/can-go-live.ts). Before the v3 migration adds the
    //    'insurance_pending' enum value the IN() filter errors, so fall back
    //    to 'approved' only.
    const query = (statuses: string[]) =>
      supabase
        .from('contractor_profiles')
        .select(PUBLIC_CONTRACTOR_COLUMNS)
        .in('verification_status', statuses)
        .not('contractor_agreement_accepted_at', 'is', null)
        .order('average_rating', { ascending: false })
        .limit(MAX_RESULTS)
    let { data: rows, error: contractorsError } = await query([
      ...LIVE_STATUSES,
    ])
    if (contractorsError) {
      ;({ data: rows, error: contractorsError } = await query(['approved']))
    }

    if (contractorsError || !rows || rows.length === 0) {
      if (contractorsError) {
        console.error(
          '[find-care] contractor_profiles query failed',
          contractorsError.message
        )
      }
      return []
    }

    const contractorRows = rows as unknown as ContractorRow[]

    // 2. Of those, only active contractor accounts (plus their avatars).
    const { data: activeProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .eq('role', 'contractor')
      .eq('is_active', true)
      .in(
        'id',
        contractorRows.map((r) => r.id)
      )

    if (profilesError || !activeProfiles) {
      if (profilesError) {
        console.error('[find-care] profiles query failed', profilesError.message)
      }
      return []
    }

    const avatarById = new Map<string, string | null>(
      activeProfiles.map((p) => [
        p.id as string,
        (p.avatar_url as string | null) ?? null,
      ])
    )

    // 3. v3 compliance columns (hold + insured). Read separately so a
    //    database without them yet still lists providers.
    const compliance = await getComplianceById(
      supabase,
      contractorRows.map((r) => r.id)
    )

    return contractorRows
      .filter((row) => avatarById.has(row.id))
      .filter((row) => !compliance.get(row.id)?.hold)
      .map((row) =>
        mapRow(
          row,
          avatarById.get(row.id) ?? null,
          compliance.get(row.id)?.insured ?? false
        )
      )
  } catch (err) {
    console.error('[find-care] failed to load providers', err)
    return []
  }
}
