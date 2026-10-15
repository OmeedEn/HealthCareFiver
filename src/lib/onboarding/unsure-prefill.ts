import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordProgress, type OnboardingFlow } from '@/lib/onboarding/progress'

// When staff place a Not sure signup (or change anyone's category), the
// assignment email deep-links into the new path's flow, which "starts at the
// first screen they haven't answered yet, with everything we already have
// pre-filled" (Single-Question Onboarding spec). The values themselves are
// prefilled into the profile columns by admin_assign_signup_path(); this
// marks the matching question ids answered in onboarding_progress so the
// flows' resumeIndex() skips them.
//
// These ids must match the professional / organization question configs.
// Only screens we can answer with certainty are marked: the account screen
// (they're signed in already), the org website when we have a real website
// (a LinkedIn profile isn't the organization's site), and the org city/state
// when both are known. The Not sure credential answer (State license /
// Certification / No) doesn't map one-to-one onto the professional
// category or license screens, so nothing else is marked for professionals.

export const UNSURE_PREFILL_QUESTION_IDS = {
  professional: {
    /** Screen 4, "Create your account". */
    account: 'account',
  },
  organization: {
    /** Screen 3, "Create your account". */
    account: 'account',
    /** Screen 4, "What's your organization's website?" */
    website: 'org_website',
    /** Screen 5, "Which city and state are you in?" */
    cityState: 'org_location',
  },
} as const

export type PrefillPath = 'INDEPENDENT' | 'PRACTICE' | 'COMPANY' | 'HIRING' | 'CLIENT'

export interface KnownAnswers {
  website: string | null
  city: string | null
  state: string | null
}

/** The flow and question ids to mark answered for an assignment (pure; exported for tests). */
export function prefilledQuestionIds(
  path: PrefillPath,
  known: KnownAnswers
): { flow: OnboardingFlow; answered: string[] } | null {
  if (path === 'INDEPENDENT') {
    return { flow: 'professional', answered: [UNSURE_PREFILL_QUESTION_IDS.professional.account] }
  }
  if (path === 'PRACTICE' || path === 'COMPANY' || path === 'HIRING') {
    const ids = UNSURE_PREFILL_QUESTION_IDS.organization
    const answered: string[] = [ids.account]
    if (known.website) answered.push(ids.website)
    if (known.city && known.state) answered.push(ids.cityState)
    return { flow: 'organization', answered }
  }
  // Clients land on the dashboard; there's no client flow to resume.
  return null
}

/**
 * Record what we already know in onboarding_progress for the assigned
 * path's flow. Service-role client (the admin's own session can't write
 * another person's progress). Never throws: a failure only means the flow
 * shows those screens again, pre-filled.
 */
export async function recordAssignmentPrefill(
  db: SupabaseClient,
  userId: string,
  path: PrefillPath,
  known: KnownAnswers
): Promise<void> {
  const plan = prefilledQuestionIds(path, known)
  if (!plan) return
  try {
    const res = await recordProgress(db, userId, plan.flow, { answered: plan.answered })
    if (!res.ok) console.error('[unsure-prefill] progress not recorded', { flow: plan.flow })
  } catch (err) {
    console.error('[unsure-prefill] progress not recorded', err instanceof Error ? err.message : err)
  }
}
