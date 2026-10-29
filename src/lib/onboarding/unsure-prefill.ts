import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordProgress, type OnboardingFlow } from '@/lib/onboarding/progress'
import { facilityTypeEnumFor, orgTypesForPath, type OrgTypeKey } from '@/lib/onboarding/organization'
import {
  isProfessionalCategory,
  type CredentialBasis,
  type ProfessionalCategory,
} from '@/lib/onboarding/professional-branch'

// When staff place a Not sure signup (or change anyone's category), the
// assignment email deep-links into the new path's flow, which "starts at the
// first screen they haven't answered yet, with everything we already have
// pre-filled" (Single-Question Onboarding spec). Name, city/state, ZIP,
// phone and website/LinkedIn are copied into the profile columns by
// admin_assign_signup_path(); this file carries over the rest of the Not
// sure answers that map cleanly, plus what staff picked when placing them,
// and marks those question ids answered in onboarding_progress so the flows
// skip them.
//
// What carries over (only into empty columns, never overwriting):
//   * Website or LinkedIn → the professional link screen (consultant /
//     educator branch) and the org website screen (a real website only: a
//     LinkedIn profile isn't the organization's site).
//   * City + state → the org location screen.
//   * Staff's pick of professional category → screen 1 of the professional
//     flow. If that pick is Other, the Not sure "state license /
//     certification / no" answer is exactly the "Do you hold a state license
//     or certification?" screen, so it carries over too.
//   * Staff's pick of organization type → screen 1 of the org flow.
//   * Company + "Just me": the person who answered the credential question is
//     the lead person, so it answers "Does the lead person hold a license or
//     certification?" (yes/no; the details are still asked).
// Not carried: "What do you do?" (free text) and the credential answer for
// anyone else — a personal license doesn't say whether a practice holds a
// facility license, and on a team the lead may be someone else.

export const UNSURE_PREFILL_QUESTION_IDS = {
  professional: {
    /** Screen 4, "Create your account". */
    account: 'account',
    /** Screen 1, "What kind of professional are you?" */
    category: 'category',
    /** Other: "Do you hold a state license or certification?" */
    credentialBasis: 'credential_basis',
    /** Consultant / educator: "Share a link to your website or LinkedIn." */
    website: 'website',
  },
  organization: {
    /** Screen 3, "Create your account". */
    account: 'account',
    /** Screen 1, "What type of organization are you?" */
    type: 'org_type',
    /** Screen 4, "What's your organization's website?" */
    website: 'org_website',
    /** Screen 5, "Which city and state are you in?" */
    cityState: 'org_location',
    /** Screen 6 (Company), the lead person's license or certification. */
    license: 'license',
  },
} as const

export type PrefillPath = 'INDEPENDENT' | 'PRACTICE' | 'COMPANY' | 'HIRING' | 'CLIENT'

export interface KnownAnswers {
  website: string | null
  /** A LinkedIn URL from the website answer (professional link screen only). */
  linkedin?: string | null
  city: string | null
  state: string | null
  /** Not sure screen 2: just_me / small_team / larger_org. */
  teamSize?: string | null
  /** Not sure screen 3: state_license / certification / none. */
  credential?: string | null
}

/** What staff picked in the queue alongside the category (optional). */
export interface StaffPicks {
  category?: ProfessionalCategory | null
  orgType?: OrgTypeKey | null
}

/** Which screen a prefilled column answers (so a failed write un-marks it). */
const QUESTION_FOR_COLUMN: Record<string, string> = {
  professional_category: UNSURE_PREFILL_QUESTION_IDS.professional.category,
  credential_basis: UNSURE_PREFILL_QUESTION_IDS.professional.credentialBasis,
  org_type: UNSURE_PREFILL_QUESTION_IDS.organization.type,
  lead_has_credential: UNSURE_PREFILL_QUESTION_IDS.organization.license,
}

/** Not sure credential answer → the professional "Other" credential basis (same question). */
const CREDENTIAL_BASIS_FOR: Record<string, CredentialBasis> = {
  state_license: 'license',
  certification: 'certification',
  none: 'none',
}

/** An org type staff may pick for a door ("Other" needs their own words, so it's left to them). */
export function isPickableOrgType(path: PrefillPath, orgType: unknown): orgType is OrgTypeKey {
  return (
    typeof orgType === 'string' &&
    orgType !== 'other' &&
    orgTypesForPath(path).some((t) => t.value === orgType)
  )
}

/** Column values to fill (only where empty) and question ids to mark, for an assignment (pure). */
export function prefillPlan(
  path: PrefillPath,
  known: KnownAnswers,
  picks: StaffPicks = {}
): { flow: OnboardingFlow; answered: string[]; columns: Record<string, unknown> } | null {
  if (path === 'INDEPENDENT') {
    const ids = UNSURE_PREFILL_QUESTION_IDS.professional
    const answered: string[] = [ids.account]
    const columns: Record<string, unknown> = {}
    // website_url was copied from the answer (website, else LinkedIn).
    if (known.website || known.linkedin) answered.push(ids.website)
    if (picks.category && isProfessionalCategory(picks.category)) {
      columns.professional_category = picks.category
      answered.push(ids.category)
      const basis = picks.category === 'other' ? CREDENTIAL_BASIS_FOR[known.credential ?? ''] : undefined
      if (basis) {
        columns.credential_basis = basis
        answered.push(ids.credentialBasis)
      }
    }
    return { flow: 'professional', answered, columns }
  }
  if (path === 'PRACTICE' || path === 'COMPANY' || path === 'HIRING') {
    const ids = UNSURE_PREFILL_QUESTION_IDS.organization
    const answered: string[] = [ids.account]
    const columns: Record<string, unknown> = {}
    if (known.website) answered.push(ids.website)
    if (known.city && known.state) answered.push(ids.cityState)
    if (isPickableOrgType(path, picks.orgType)) {
      columns.org_type = picks.orgType
      columns.facility_type = facilityTypeEnumFor(picks.orgType)
      columns.org_type_other = null
      answered.push(ids.type)
    }
    const credential = known.credential ?? ''
    if (path === 'COMPANY' && known.teamSize === 'just_me' && credential in CREDENTIAL_BASIS_FOR) {
      columns.lead_has_credential = credential !== 'none'
      answered.push(ids.license)
    }
    return { flow: 'organization', answered, columns }
  }
  // Clients land on the dashboard; there's no client flow to resume.
  return null
}

/** The flow and question ids to mark answered for an assignment (pure; kept for callers/tests). */
export function prefilledQuestionIds(
  path: PrefillPath,
  known: KnownAnswers,
  picks: StaffPicks = {}
): { flow: OnboardingFlow; answered: string[] } | null {
  const plan = prefillPlan(path, known, picks)
  return plan && { flow: plan.flow, answered: plan.answered }
}

/**
 * Fill the mapped columns (only where still empty) and record the matching
 * question ids in onboarding_progress for the assigned path's flow.
 * Service-role client (the admin's own session can't write another person's
 * profile or progress). Never throws: a failure only means the flow asks
 * those screens again.
 */
export async function recordAssignmentPrefill(
  db: SupabaseClient,
  userId: string,
  path: PrefillPath,
  known: KnownAnswers,
  picks: StaffPicks = {}
): Promise<void> {
  const plan = prefillPlan(path, known, picks)
  if (!plan) return
  try {
    let answered = plan.answered
    const keys = Object.keys(plan.columns).filter((k) => k !== 'facility_type' && k !== 'org_type_other')
    if (keys.length) {
      const table = plan.flow === 'professional' ? 'contractor_profiles' : 'facility_profiles'
      const { data: row, error: readError } = await db
        .from(table)
        .select(keys.join(', '))
        .eq('id', userId)
        .maybeSingle()
      const current = (row ?? null) as unknown as Record<string, unknown> | null
      const update: Record<string, unknown> = {}
      if (!current) {
        // Can't tell what's already there: copy nothing, mark nothing extra.
        if (readError) console.error('[unsure-prefill] profile not read', { table, code: readError.code })
        const unmark = new Set(keys.map((k) => QUESTION_FOR_COLUMN[k]).filter(Boolean))
        answered = answered.filter((id) => !unmark.has(id))
      } else {
        for (const k of keys) {
          const v = current[k]
          if (v == null || v === '') update[k] = plan.columns[k]
        }
      }
      if ('org_type' in update) {
        update.facility_type = plan.columns.facility_type
        update.org_type_other = plan.columns.org_type_other
      }
      if (Object.keys(update).length) {
        const { error } = await db.from(table).update(update).eq('id', userId)
        if (error) {
          console.error('[unsure-prefill] answers not copied', { table, code: error.code })
          const skipped = new Set(Object.keys(update).map((k) => QUESTION_FOR_COLUMN[k]).filter(Boolean))
          answered = answered.filter((id) => !skipped.has(id))
        }
      }
    }
    const res = await recordProgress(db, userId, plan.flow, { answered })
    if (!res.ok) console.error('[unsure-prefill] progress not recorded', { flow: plan.flow })
  } catch (err) {
    console.error('[unsure-prefill] prefill not recorded', err instanceof Error ? err.message : err)
  }
}
