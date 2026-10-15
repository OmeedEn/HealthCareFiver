import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
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
import { ProfessionalOnboardingFlow, type InitialDisclosures } from './flow'
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
  const { data: profile, error } = await supabase
    .from('contractor_profiles')
    .select(
      'professional_category, credential_basis, other_profession, license_type, certification_type, specialties, teaching_topics, state_license_number, license_state, certifying_organization, website_url, self_disclosures, onboarding_completed_at'
    )
    .eq('id', user.id)
    .single()
  if (error || !profile) {
    throw new Error(`Contractor ${user.id} has no readable contractor_profiles row.`)
  }
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

  const answers = toAnswers(p, progress)
  return (
    <ProfessionalOnboardingFlow
      key={user.id}
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
