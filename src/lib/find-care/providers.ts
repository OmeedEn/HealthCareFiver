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

function mapRow(row: ContractorRow, avatarUrl: string | null): PublicProvider {
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
async function getReadClient(): Promise<SupabaseClient> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createAdminClient()
  }
  return (await createClient()) as unknown as SupabaseClient
}

export async function getLiveProviders(): Promise<PublicProvider[]> {
  try {
    const supabase = await getReadClient()

    // 1. "Live" professionals: admin-approved AND contractor agreement
    //    accepted (mirrors SQL can_go_live; see src/lib/auth/can-go-live.ts).
    const { data: rows, error: contractorsError } = await supabase
      .from('contractor_profiles')
      .select(PUBLIC_CONTRACTOR_COLUMNS)
      .eq('verification_status', 'approved')
      .not('contractor_agreement_accepted_at', 'is', null)
      .order('average_rating', { ascending: false })
      .limit(MAX_RESULTS)

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

    return contractorRows
      .filter((row) => avatarById.has(row.id))
      .map((row) => mapRow(row, avatarById.get(row.id) ?? null))
  } catch (err) {
    console.error('[find-care] failed to load providers', err)
    return []
  }
}
