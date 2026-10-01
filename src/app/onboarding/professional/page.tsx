import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
import { DEMO_CONTRACTOR, isDemoMode } from '@/lib/demo/data'
import { OnboardingWizard } from './wizard'
import { PendingScreen } from './pending-screen'
import {
  type CredentialsData,
  type OfferingDraft,
  type ProCategory,
  type UploadedDoc,
  type WizardStep,
} from './shared'

export const metadata: Metadata = {
  title: 'Set up your professional profile | Sanus',
}

const CATEGORIES: ProCategory[] = ['clinical', 'allied', 'consultant', 'educator']
const ONBOARDING_CREDENTIAL_TYPES = [
  'license',
  'certification',
  'malpractice_insurance',
  'resume',
  'government_id',
]

/**
 * Professional onboarding, steps 2–5 (step 1 — account creation — happens on
 * /signup/professional). Progress lives in contractor_profiles.onboarding_step
 * (the NEXT step to show) and every step saves before advancing, so a refresh
 * resumes exactly where the professional left off. Once
 * onboarding_completed_at is set, this route shows the pending screen.
 */
export default async function ProfessionalOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  if (isDemoMode()) {
    const sp = await searchParams
    return renderDemo(typeof sp.step === 'string' ? sp.step : undefined)
  }

  const user = await currentUser()
  if (!user) redirect('/login?redirectTo=/onboarding/professional')
  if (user.role !== 'contractor') redirect('/dashboard')

  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('contractor_profiles')
    .select(
      [
        'first_name',
        'professional_category',
        'onboarding_step',
        'onboarding_completed_at',
        'verification_status',
        'license_type',
        'specialties',
        'state_license_number',
        'license_state',
        'license_states',
        'npi_number',
        'years_of_experience',
        'certification_type',
        'certifying_organization',
        'certification_number',
        'consulting_background',
        'client_types',
        'website_url',
        'primary_background',
        'teaching_topics',
        'ceu_accreditation',
      ].join(', ')
    )
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error(`Contractor ${user.id} has no readable contractor_profiles row.`)
  }
  const p = profile as unknown as Record<string, unknown>

  const firstName = str(p.first_name)

  if (p.onboarding_completed_at) {
    return (
      <PendingScreen
        firstName={firstName}
        verificationStatus={str(p.verification_status) || 'not_submitted'}
      />
    )
  }

  const category = CATEGORIES.includes(p.professional_category as ProCategory)
    ? (p.professional_category as ProCategory)
    : null

  const [{ data: creds }, { data: offerings }] = await Promise.all([
    supabase
      .from('credentials')
      .select('id, credential_type, name, document_filename, document_url, status, created_at')
      .eq('contractor_id', user.id)
      .in('credential_type', ONBOARDING_CREDENTIAL_TYPES)
      .order('created_at', { ascending: false }),
    supabase
      .from('professional_offerings')
      .select('*')
      .eq('contractor_id', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: true }),
  ])

  return (
    <OnboardingWizard
      key={user.id}
      userId={user.id}
      initialStep={resolveStep(Number(p.onboarding_step ?? 2), category)}
      initialCategory={category}
      initialCredentials={toCredentialsData(p)}
      initialDocs={(creds ?? []) as UploadedDoc[]}
      initialOfferings={(offerings ?? []).map(toOfferingDraft)}
    />
  )
}

/** Clamp the stored step to 2..5; nothing past step 2 without a category. */
function resolveStep(raw: number, category: ProCategory | null): WizardStep {
  const n = Number.isFinite(raw) ? Math.round(raw) : 2
  const step = Math.min(5, Math.max(2, n)) as WizardStep
  return category ? step : 2
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function toCredentialsData(p: Record<string, unknown>): CredentialsData {
  const states = strArr(p.license_states)
  const legacyState = str(p.license_state)
  const ceu = str(p.ceu_accreditation)
  return {
    license_type: str(p.license_type),
    specialty: strArr(p.specialties)[0] ?? '',
    state_license_number: str(p.state_license_number),
    license_states: states.length > 0 ? states : legacyState ? [legacyState] : [],
    npi_number: str(p.npi_number),
    years_of_experience:
      typeof p.years_of_experience === 'number' ? String(p.years_of_experience) : '',
    certification_type: str(p.certification_type),
    certifying_organization: str(p.certifying_organization),
    certification_number: str(p.certification_number),
    consulting_background: str(p.consulting_background),
    client_types: strArr(p.client_types),
    website_url: str(p.website_url),
    primary_background: str(p.primary_background),
    teaching_topics: str(p.teaching_topics),
    ceu_accreditation:
      ceu === 'yes' || ceu === 'seeking' || ceu === 'no' ? ceu : '',
  }
}

function toOfferingDraft(row: Record<string, unknown>): OfferingDraft {
  const cents = typeof row.price_cents === 'number' ? row.price_cents : null
  const kind = row.kind === 'consulting' || row.kind === 'event' ? row.kind : 'service'
  const format = str(row.format)
  return {
    kind,
    title: str(row.title),
    description: str(row.description),
    format:
      format === 'virtual' || format === 'in_person' || format === 'home_visit'
        ? format
        : '',
    duration_minutes:
      typeof row.duration_minutes === 'number' ? String(row.duration_minutes) : '',
    engagement_type: str(row.engagement_type),
    custom_quote: row.custom_quote === true,
    event_type: str(row.event_type),
    starts_at: str(row.starts_at),
    date_later: kind === 'event' && !row.starts_at,
    capacity: typeof row.capacity === 'number' ? String(row.capacity) : '',
    price: cents !== null && !row.is_free ? (cents / 100).toString() : '',
    is_free: row.is_free === true,
  }
}

/* ───────────── Demo mode (no Supabase) ───────────── */

const DEMO_CREDENTIALS: CredentialsData = {
  license_type: 'RN',
  specialty: DEMO_CONTRACTOR.specialties[0],
  state_license_number: DEMO_CONTRACTOR.state_license_number,
  license_states: [DEMO_CONTRACTOR.license_state],
  npi_number: '',
  years_of_experience: String(DEMO_CONTRACTOR.years_of_experience),
  certification_type: '',
  certifying_organization: '',
  certification_number: '',
  consulting_background: '',
  client_types: [],
  website_url: '',
  primary_background: '',
  teaching_topics: '',
  ceu_accreditation: '',
}

function renderDemo(stepParam: string | undefined) {
  if (stepParam === 'done' || stepParam === 'approved') {
    return (
      <PendingScreen
        firstName={DEMO_CONTRACTOR.first_name}
        verificationStatus={stepParam === 'approved' ? 'approved' : 'pending_review'}
      />
    )
  }
  const n = Number(stepParam)
  const step: WizardStep = n === 3 || n === 4 || n === 5 ? n : 2
  return (
    <OnboardingWizard
      userId={DEMO_CONTRACTOR.id}
      initialStep={step}
      initialCategory={step === 2 ? null : 'clinical'}
      initialCredentials={DEMO_CREDENTIALS}
      initialDocs={[]}
      initialOfferings={[]}
    />
  )
}
