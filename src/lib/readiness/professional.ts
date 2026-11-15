// Loads everything buildProfessionalChecklist needs for one professional,
// with the same queries and fallbacks the dashboard uses
// (src/app/(dashboard)/dashboard/page.tsx), so the profile editor shows the
// same readiness numbers as the dashboard. Works with either Supabase client
// (server or browser); pass the caller's own RLS client.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CredentialLike,
  ProfessionalChecklistInput,
} from '@/lib/onboarding/checklist-professional'
import { effectiveBranch, isProfessionalCategory } from '@/lib/onboarding/professional-branch'
import { hasCurrentMalpractice, type CredentialRow } from '@/lib/compliance/rules'

const PROFILE_COLUMNS =
  'verification_status, professional_category, credential_basis, bio, specialties, languages, years_of_experience, npi_number, license_issue_date, license_expiration_date, other_names, telehealth_states, website_url, offers_high_risk_services, insured_verified_at'

export async function loadProfessionalChecklistInput(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfessionalChecklistInput | null> {
  const [
    { data: row },
    { data: agreementRow, error: agreementError },
    { data: account },
    { data: credentialRows },
    { data: progressRow },
    { count: availabilityCount, error: availabilityError },
    { data: listingRows, error: listingsError },
  ] = await Promise.all([
    supabase.from('contractor_profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
    // Separate query so a missing column can't break the main select.
    supabase.from('contractor_profiles').select('contractor_agreement_accepted_at').eq('id', userId).maybeSingle(),
    supabase.from('profiles').select('phone, avatar_url, stripe_connect_onboarded').eq('id', userId).maybeSingle(),
    supabase
      .from('credentials')
      .select('credential_type, document_url, status, expiration_date')
      .eq('contractor_id', userId),
    supabase
      .from('onboarding_progress')
      .select('answered')
      .eq('user_id', userId)
      .eq('flow', 'professional')
      .maybeSingle(),
    supabase
      .from('contractor_availability')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', userId)
      .eq('is_blocked', false),
    supabase
      .from('professional_offerings')
      .select('status, requires_malpractice')
      .eq('contractor_id', userId)
      .then(async (res) =>
        res.error ? await supabase.from('professional_offerings').select('status').eq('contractor_id', userId) : res
      ),
  ])
  if (!row) return null
  const r = row as Record<string, unknown>
  const category = r.professional_category
  const creds = (credentialRows ?? []) as (CredentialLike & { expiration_date: string | null })[]
  const insured =
    !!r.insured_verified_at && hasCurrentMalpractice(creds as unknown as CredentialRow[], new Date())
  const listingList = listingsError
    ? null
    : ((listingRows ?? []) as { status: string; requires_malpractice?: boolean | null }[])

  return {
    branch: isProfessionalCategory(category) ? effectiveBranch(category, r.credential_basis as string | null) : null,
    verificationStatus: (r.verification_status as string | null) ?? null,
    profile: {
      ...(r as ProfessionalChecklistInput['profile']),
      contractor_agreement_accepted_at: agreementError
        ? null
        : ((agreementRow?.contractor_agreement_accepted_at as string | null | undefined) ?? null),
    },
    phone: (account?.phone as string | null) ?? null,
    avatarUrl: (account?.avatar_url as string | null) ?? null,
    stripeConnectOnboarded: !!account?.stripe_connect_onboarded,
    credentials: creds,
    listings: listingList
      ? {
          total: listingList.length,
          published: listingList.filter((l) => l.status === 'published').length,
          inReview: listingList.filter((l) => l.status === 'pending_review').length,
          awaitingInsurance: insured
            ? 0
            : listingList.filter((l) => l.status === 'published' && l.requires_malpractice === true).length,
        }
      : undefined,
    availabilitySlots: availabilityError ? undefined : (availabilityCount ?? 0),
    answered: Array.isArray(progressRow?.answered) ? (progressRow.answered as string[]) : [],
  }
}
