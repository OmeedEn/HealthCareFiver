import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
import { DEMO_CONTRACTOR, isDemoMode } from '@/lib/demo/data'
import {
  isCredentialBasis,
  isProfessionalCategory,
} from '@/lib/onboarding/professional-branch'
import { OnboardingWizard } from './wizard'
import {
  DISCLOSURE_KEYS,
  emptyDisclosures,
  emptyInsurance,
  type CredentialBasis,
  type CredentialsData,
  type DisclosuresData,
  type InsuranceData,
  type OfferingDraft,
  type ProCategory,
  type UploadedDoc,
  type WizardStep,
  type YesNo,
} from './shared'

export const metadata: Metadata = {
  title: 'Set up your professional profile | Sanus',
}

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
 * onboarding_completed_at is set, this route redirects to /dashboard (which
 * shows the "under review" banner) — there is no waiting screen.
 */
export default async function ProfessionalOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  if (isDemoMode()) {
    const sp = await searchParams
    const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
    return renderDemo(one('step'), one('category'), one('basis'))
  }

  const user = await currentUser()
  if (!user) redirect('/login?redirectTo=/onboarding/professional')
  if (user.role !== 'contractor') redirect('/dashboard')

  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('contractor_profiles')
    .select(
      [
        'professional_category',
        'other_profession',
        'credential_basis',
        'onboarding_step',
        'onboarding_completed_at',
        'legal_name',
        'other_names',
        'license_type',
        'specialties',
        'state_license_number',
        'license_issue_date',
        'license_expiration_date',
        'license_state',
        'license_states',
        'has_compact_license',
        'telehealth_states',
        'npi_number',
        'years_of_experience',
        'certification_type',
        'certifying_organization',
        'consulting_background',
        'client_types',
        'website_url',
        'primary_background',
        'teaching_topics',
        'ceu_accreditation',
        'offers_high_risk_services',
        'self_disclosures',
        'carries_liability_insurance',
      ].join(', ')
    )
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error(`Contractor ${user.id} has no readable contractor_profiles row.`)
  }
  const p = profile as unknown as Record<string, unknown>

  if (p.onboarding_completed_at) redirect('/dashboard')

  const category = isProfessionalCategory(p.professional_category)
    ? p.professional_category
    : null
  const credentialBasis = isCredentialBasis(p.credential_basis) ? p.credential_basis : null

  const [{ data: creds }, { data: offerings }] = await Promise.all([
    supabase
      .from('credentials')
      .select(
        'id, credential_type, name, document_filename, document_url, status, issuing_authority, license_number, coverage_amount, expiration_date, created_at'
      )
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
  const docs = (creds ?? []) as UploadedDoc[]

  return (
    <OnboardingWizard
      key={user.id}
      userId={user.id}
      initialStep={resolveStep(Number(p.onboarding_step ?? 2), category, credentialBasis)}
      initialCategory={category}
      initialOtherProfession={str(p.other_profession)}
      initialCredentialBasis={credentialBasis}
      initialCredentials={toCredentialsData(p)}
      initialDocs={docs}
      initialInsurance={toInsuranceData(p, docs)}
      initialOfferings={(offerings ?? []).map(toOfferingDraft)}
    />
  )
}

/**
 * Clamp the stored step to 2..5; nothing past step 2 without a category
 * (and, for "Other", a credential basis — it decides the step-3 branch).
 */
function resolveStep(
  raw: number,
  category: ProCategory | null,
  basis: CredentialBasis | null
): WizardStep {
  const n = Number.isFinite(raw) ? Math.round(raw) : 2
  const step = Math.min(5, Math.max(2, n)) as WizardStep
  if (!category || (category === 'other' && !basis)) return 2
  return step
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function yesNo(v: unknown): YesNo {
  return v === true ? 'yes' : v === false ? 'no' : ''
}

function toDisclosures(v: unknown): DisclosuresData {
  const out = emptyDisclosures()
  if (!v || typeof v !== 'object') return out
  const obj = v as Record<string, unknown>
  for (const key of DISCLOSURE_KEYS) {
    const d = obj[key]
    if (!d || typeof d !== 'object') continue
    const rec = d as Record<string, unknown>
    out[key] = { answer: yesNo(rec.answer), details: str(rec.details) }
  }
  return out
}

function toCredentialsData(p: Record<string, unknown>): CredentialsData {
  const states = strArr(p.license_states)
  const legacyState = str(p.license_state)
  const ceu = str(p.ceu_accreditation)
  return {
    legal_name: str(p.legal_name),
    other_names: str(p.other_names),
    license_type: str(p.license_type),
    specialty: strArr(p.specialties)[0] ?? '',
    state_license_number: str(p.state_license_number),
    license_issue_date: str(p.license_issue_date).slice(0, 10),
    license_expiration_date: str(p.license_expiration_date).slice(0, 10),
    license_states: states.length > 0 ? states : legacyState ? [legacyState] : [],
    has_compact_license: yesNo(p.has_compact_license),
    telehealth_states: strArr(p.telehealth_states),
    npi_number: str(p.npi_number),
    years_of_experience:
      typeof p.years_of_experience === 'number' ? String(p.years_of_experience) : '',
    certification_type: str(p.certification_type),
    certifying_organization: str(p.certifying_organization),
    consulting_background: str(p.consulting_background),
    client_types: strArr(p.client_types),
    website_url: str(p.website_url),
    primary_background: str(p.primary_background),
    teaching_topics: str(p.teaching_topics),
    ceu_accreditation:
      ceu === 'yes' || ceu === 'seeking' || ceu === 'no' ? ceu : '',
    offers_high_risk_services: yesNo(p.offers_high_risk_services),
    self_disclosures: toDisclosures(p.self_disclosures),
  }
}

/** Prefill the liability answers from the profile + newest usable certificate. */
function toInsuranceData(p: Record<string, unknown>, docs: UploadedDoc[]): InsuranceData {
  const cert = docs.find(
    (d) =>
      d.credential_type === 'malpractice_insurance' && d.document_url && d.status !== 'rejected'
  )
  return {
    carries_liability_insurance: yesNo(p.carries_liability_insurance),
    carrier: str(cert?.issuing_authority),
    policy_number: str(cert?.license_number),
    coverage_amount: str(cert?.coverage_amount),
    expiration_date: str(cert?.expiration_date).slice(0, 10),
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
    involves_medical_procedures: row.involves_medical_procedures === true,
  }
}

/* ───────────── Demo mode (no Supabase) ───────────── */

const DEMO_CREDENTIALS: CredentialsData = {
  legal_name: `${DEMO_CONTRACTOR.first_name} ${DEMO_CONTRACTOR.last_name}`,
  other_names: '',
  license_type: 'RN',
  specialty: DEMO_CONTRACTOR.specialties[0],
  state_license_number: DEMO_CONTRACTOR.state_license_number,
  license_issue_date: '',
  license_expiration_date: '',
  license_states: [DEMO_CONTRACTOR.license_state],
  has_compact_license: '',
  telehealth_states: [],
  npi_number: '',
  years_of_experience: String(DEMO_CONTRACTOR.years_of_experience),
  certification_type: '',
  certifying_organization: '',
  consulting_background: '',
  client_types: [],
  website_url: '',
  primary_background: '',
  teaching_topics: '',
  ceu_accreditation: '',
  offers_high_risk_services: '',
  self_disclosures: emptyDisclosures(),
}

/**
 * Demo previews: ?step=2..5, optionally &category=clinical|allied|consultant|
 * educator|other and (for other) &basis=license|certification|none.
 */
function renderDemo(
  stepParam: string | undefined,
  categoryParam: string | undefined,
  basisParam: string | undefined
) {
  if (stepParam === 'done') redirect('/dashboard')
  const n = Number(stepParam)
  const step: WizardStep = n === 3 || n === 4 || n === 5 ? n : 2
  const category: ProCategory = isProfessionalCategory(categoryParam)
    ? categoryParam
    : 'clinical'
  const basis: CredentialBasis | null =
    category === 'other' ? (isCredentialBasis(basisParam) ? basisParam : 'license') : null
  return (
    <OnboardingWizard
      userId={DEMO_CONTRACTOR.id}
      initialStep={step}
      initialCategory={step === 2 && !categoryParam ? null : category}
      initialOtherProfession={category === 'other' ? 'Midwife' : ''}
      initialCredentialBasis={basis}
      initialCredentials={DEMO_CREDENTIALS}
      initialDocs={[]}
      initialInsurance={emptyInsurance()}
      initialOfferings={[]}
    />
  )
}
