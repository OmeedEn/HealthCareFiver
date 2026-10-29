import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentUser } from '@/lib/auth/roles'
import { TERMS_VERSION } from '@/lib/legal'
import { computeGaps, namePrefill } from '@/lib/onboarding/account-gaps'
import { canConvertNewProfessional } from '@/lib/onboarding/google-account'
import { PRO_SIGNUP_COOKIE, parseProSignupCookie } from '@/lib/onboarding/professional-google'
import { accountPathFor, hasFullName } from '@/lib/onboarding/account-paths'
import { isSignupPath } from '@/lib/onboarding/signup-path'
import { DEMO_CONTRACTOR, isDemoMode } from '@/lib/demo/data'
import { getProgress, type OnboardingProgress } from '@/lib/onboarding/progress'
import {
  isCredentialBasis,
  isProfessionalCategory,
} from '@/lib/onboarding/professional-branch'
import {
  DISCLOSURE_KEYS,
  EMPTY_PRO_ANSWERS,
  PRO_Q,
  branchOf,
  proValid,
  type ProSignupAnswers,
} from '@/lib/onboarding/questions/professional'
import { ProfessionalOnboardingFlow, type AccountStep, type InitialDisclosures } from './flow'
import type { UploadedDoc } from './shared'

export const metadata: Metadata = {
  title: 'Finish your application | Sanus',
}

const ONBOARDING_CREDENTIAL_TYPES = ['license', 'certification', 'resume', 'government_id']

/**
 * Professional onboarding after the account (Single-Question Onboarding
 * spec, screens 5–8: credential upload, government ID, disclosures for
 * licensed + allied, confirm and submit). Screens 1–3 are asked here too
 * when they weren't answered before the account (Google without its
 * cookie, a Not sure account staff placed as independent, older accounts).
 * Every screen saves as it's answered (onboarding_progress), so a refresh
 * resumes on the first unanswered screen. Once submitted
 * (onboarding_completed_at), this route sends people to /dashboard.
 *
 * Google signups land here still owing the account screens Google skipped
 * (Terms consent, and a name if Google didn't share one): those become the
 * flow's first screens. A brand-new Google account that arrives without its
 * signup path (no professional cookie, no signup_path, nothing answered) is
 * first asked which path it meant, so an organization, client or Not sure
 * signup that lost its `next`/cookie isn't onboarded as a professional.
 */
export default async function ProfessionalOnboardingPage() {
  if (isDemoMode()) {
    return (
      <ProfessionalOnboardingFlow
        userId={DEMO_CONTRACTOR.id}
        includeIdentity={false}
        initialAnswers={{ ...EMPTY_PRO_ANSWERS, category: 'clinical', profession: 'RN (Registered nurse)' }}
        initialDocs={[]}
        initialDisclosures={{ picked: [], details: '', none: false }}
        progress={{ answered: [PRO_Q.account], skipped: [] }}
      />
    )
  }

  const user = await currentUser()
  if (!user) redirect('/login?redirectTo=/onboarding/professional')
  if (user.role !== 'contractor') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: profile, error }, { data: auth }, { data: account }] = await Promise.all([
    supabase
      .from('contractor_profiles')
      .select(
        'first_name, last_name, professional_category, credential_basis, other_profession, license_type, certification_type, specialties, teaching_topics, state_license_number, license_state, certifying_organization, website_url, self_disclosures, onboarding_completed_at'
      )
      .eq('id', user.id)
      .single(),
    supabase.auth.getUser(),
    supabase.from('profiles').select('signup_path').eq('id', user.id).single(),
  ])
  if (error || !profile) {
    throw new Error(`Contractor ${user.id} has no readable contractor_profiles row.`)
  }
  const authUser = auth.user
  if (!authUser) redirect('/login?redirectTo=/onboarding/professional')
  const p = profile as Record<string, unknown>
  if (p.onboarding_completed_at) redirect('/dashboard')

  const [progress, { data: creds }] = await Promise.all([
    getProgress(supabase, user.id, 'professional'),
    supabase
      .from('credentials')
      .select('id, credential_type, name, document_filename, document_url, status')
      .eq('contractor_id', user.id)
      .in('credential_type', ONBOARDING_CREDENTIAL_TYPES)
      .order('created_at', { ascending: false }),
  ])

  let answers = toAnswers(p, progress)

  // Account screens Google skipped (see AccountStep).
  const contractorName = profile as { first_name: string | null; last_name: string | null }
  const gaps = computeGaps(authUser, contractorName)
  let accountStep: AccountStep | null = null
  if (gaps.name || gaps.terms) {
    const prefill = namePrefill(authUser, contractorName)
    // Screens 1–3 from /signup/professional's Google cookie: saved by the
    // account screen (finishAccount); shown now so the flow skips them.
    const cookieAnswers = parseProSignupCookie((await cookies()).get(PRO_SIGNUP_COOKIE)?.value)
    if (cookieAnswers && !answers.category) answers = { ...answers, ...cookieAnswers }

    const signupPath = (account as { signup_path?: string | null } | null)?.signup_path ?? null
    const untouched =
      gaps.terms &&
      !cookieAnswers &&
      progress.answered.length === 0 &&
      progress.skipped.length === 0
    const convertible = untouched && (await canConvertNewProfessional(createAdminClient(), authUser))
    // A door was recorded but the conversion never happened: finish it there.
    const pending = convertible && isSignupPath(signupPath) ? accountPathFor(signupPath, false) : null
    if (pending) redirect(pending)

    accountStep = {
      needsName: gaps.name && (!hasFullName(prefill) || !gaps.terms),
      needsTerms: gaps.terms,
      prefill,
      termsVersion: TERMS_VERSION,
      pickPath: convertible && !signupPath,
    }
  }

  return (
    <ProfessionalOnboardingFlow
      // Remount once the account screens are done so the flow resumes from
      // the freshly saved answers (router.refresh after finishAccount).
      key={`${user.id}:${accountStep ? 'account' : 'application'}`}
      account={accountStep}
      userId={user.id}
      includeIdentity={!identityComplete(answers)}
      initialAnswers={answers}
      initialDocs={(creds ?? []) as UploadedDoc[]}
      initialDisclosures={toDisclosures(p.self_disclosures, progress)}
      progress={progress}
    />
  )
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Screens 1–3 answers from the stored profile columns. */
function toAnswers(p: Record<string, unknown>, progress: OnboardingProgress): ProSignupAnswers {
  const category = isProfessionalCategory(p.professional_category) ? p.professional_category : ''
  const specialties = Array.isArray(p.specialties) ? p.specialties.filter((x): x is string => typeof x === 'string') : []
  const profession =
    category === 'clinical'
      ? str(p.license_type)
      : category === 'allied'
        ? str(p.certification_type)
        : category === 'consultant'
          ? (specialties[0] ?? '')
          : category === 'educator'
            ? str(p.teaching_topics)
            : ''
  const website = str(p.website_url)
  return {
    category,
    profession,
    other_profession: str(p.other_profession),
    credential_basis: isCredentialBasis(p.credential_basis) ? p.credential_basis : '',
    license_number: str(p.state_license_number),
    license_state: str(p.license_state),
    certifying_organization: str(p.certifying_organization),
    website_url: website,
    // Answered the link screen with no link = "I don't have one".
    no_website: !website && progress.answered.includes(PRO_Q.website),
  }
}

/** True when screens 1–3 have everything we need. */
function identityComplete(a: ProSignupAnswers): boolean {
  const branch = branchOf(a)
  if (!branch) return false
  if (a.category === 'other' ? !proValid.profession(a.other_profession) : !proValid.profession(a.profession)) {
    return false
  }
  if (branch === 'clinical') return proValid.licenseNumber(a.license_number) && proValid.state(a.license_state)
  if (branch === 'allied') return proValid.certifyingOrg(a.certifying_organization)
  return a.no_website || !!a.website_url
}

function toDisclosures(v: unknown, progress: OnboardingProgress): InitialDisclosures {
  const obj = v && typeof v === 'object' ? (v as Record<string, { answer?: unknown; details?: unknown }>) : {}
  const picked = DISCLOSURE_KEYS.filter((k) => obj[k]?.answer === true)
  const details = picked.map((k) => str(obj[k]?.details)).find(Boolean) ?? ''
  return {
    picked,
    details,
    none:
      picked.length === 0 &&
      (progress.answered.includes(PRO_Q.disclosures) ||
        DISCLOSURE_KEYS.every((k) => typeof obj[k]?.answer === 'boolean')),
  }
}
