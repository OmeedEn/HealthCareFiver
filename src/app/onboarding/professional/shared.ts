/**
 * Shared types, copy and validation for /onboarding/professional (steps 2–5).
 * Imported by both the server page/actions and the client step components,
 * so it must stay free of server-only dependencies.
 */
import { z } from 'zod'
import { US_STATES } from '@/lib/utils/constants'
import { isValidNpiFormat } from '@/lib/integrations/npi-registry'
import {
  branchHasComplianceQuestions,
  type CredentialBasis,
  type ProfessionalBranch,
  type ProfessionalCategory,
} from '@/lib/onboarding/professional-branch'

export type ProCategory = ProfessionalCategory
export type Branch = ProfessionalBranch
export type { CredentialBasis }
export type WizardStep = 2 | 3 | 4 | 5
export type YesNo = '' | 'yes' | 'no'

export const TOTAL_STEPS = 5

export const CATEGORY_OPTIONS: { key: ProCategory; label: string }[] = [
  {
    key: 'clinical',
    label: 'Licensed clinical (MD, DO, NP, PA, RN, PT, LCSW, RDN, etc.)',
  },
  {
    key: 'allied',
    label: 'Allied or certified (trainer, coach, doula, acupuncturist, etc.)',
  },
  {
    key: 'consultant',
    label:
      'Healthcare consultant (attorney, compliance, billing, nursing consultant, etc.)',
  },
  {
    key: 'educator',
    label:
      'Educator or trainer (CEU courses, workshops, certification programs)',
  },
  {
    key: 'other',
    label: "Other (my profession isn't listed)",
  },
]

export const OTHER_PROFESSION_MAX = 100

export const CREDENTIAL_BASIS_OPTIONS: { value: CredentialBasis; label: string }[] = [
  { value: 'license', label: 'State license' },
  { value: 'certification', label: 'Certification' },
  { value: 'none', label: 'No' },
]

/* ───────────── Step 3 compliance questions (licensed + allied) ───────────── */

export const PRACTICE_QUESTION =
  'Will you offer any of these? In-person or hands-on care, home visits, prescribing, injectables, or IVs'

export const DISCLOSURE_KEYS = [
  'license_action',
  'exclusion',
  'conviction',
  'malpractice',
] as const
export type DisclosureKey = (typeof DISCLOSURE_KEYS)[number]

export const DISCLOSURE_QUESTIONS: Record<DisclosureKey, string> = {
  license_action:
    'Has any license or certification you hold or have held ever been suspended, revoked, restricted, surrendered, or under investigation?',
  exclusion: 'Have you ever been excluded from Medicare or Medicaid?',
  conviction: 'Have you ever had a felony or healthcare-related conviction?',
  malpractice: 'Have you ever had any malpractice judgments or settlements?',
}

export const DISCLOSURE_DETAILS_MAX = 2000

/* ───────────── Step 4 copy ───────────── */

export const LIABILITY_QUESTION = 'Do you carry professional liability insurance?'

export const MALPRACTICE_REQUIRED_NOTICE =
  'Malpractice coverage is required for the services you selected. You have 30 days after approval to upload it.'

export const ATTEST_ACCURATE_LABEL =
  'I certify this information is accurate and will notify Sanus of any changes.'

export const AUTHORIZE_CHECKS_LABEL =
  'I authorize Sanus to verify my credentials with licensing boards and run exclusion screenings.'

export const MEDICAL_PROCEDURES_LABEL = 'Involves prescribing, injectables, or IVs'

export const REVIEW_NOTE =
  "We review every application within 24-48 hours. You'll get an email when you're approved."

export const CONSULTING_BACKGROUND_MAX = 300

/* ───────────── Step 3 option lists ───────────── */

export const LICENSE_TYPE_SUGGESTIONS = [
  'MD', 'DO', 'NP', 'PA', 'RN', 'LPN', 'CRNA', 'PT', 'OT', 'SLP',
  'LCSW', 'LMFT', 'LPC', 'Psychologist', 'PharmD', 'RDN', 'DC', 'DPM', 'DDS',
]

export const CONSULTANT_CLIENT_TYPES = [
  'Hospitals & health systems',
  'Private practices & clinics',
  'Digital health & startups',
  'Payers & insurers',
  'Pharma, biotech & devices',
  'Long-term care & home health',
  'Government & public health',
  'Individuals & patients',
]

export const EDUCATOR_AUDIENCES = [
  'Nurses',
  'Physicians',
  'Advanced practice providers',
  'Allied health professionals',
  'Mental health professionals',
  'Students',
  'Healthcare organizations & teams',
  'General public',
]

export const CEU_OPTIONS: { value: 'yes' | 'seeking' | 'no'; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'seeking', label: 'Seeking accreditation' },
  { value: 'no', label: 'No' },
]

/* ───────────── Step 4 document slots ───────────── */

export type DocSlotKey = 'license' | 'malpractice' | 'resume' | 'government_id'

export type CredentialTypeValue =
  | 'license'
  | 'certification'
  | 'malpractice_insurance'
  | 'resume'
  | 'government_id'

export interface DocSlot {
  key: DocSlotKey
  label: string
  hint: string
  credentialType: CredentialTypeValue
  /** credential_type values that satisfy this slot (e.g. an older license upload) */
  matches: CredentialTypeValue[]
  required: boolean
  acceptsDocx?: boolean
}

/**
 * The always-shown document slots for a branch. The malpractice certificate
 * is NOT here: it is only collected when the professional answers "Yes" to the
 * liability-insurance question (see MALPRACTICE_SLOT).
 */
export function docSlotsFor(branch: Branch): DocSlot[] {
  const slots: DocSlot[] = []
  if (branch !== 'consultant') {
    const isClinical = branch === 'clinical'
    slots.push({
      key: 'license',
      label: 'Photo of license or certification',
      hint: isClinical
        ? 'Your current state license, with your name and expiration date visible.'
        : 'Your current certification, with your name and certifying organization visible.',
      credentialType: isClinical ? 'license' : 'certification',
      matches: ['license', 'certification'],
      required: true,
    })
  }
  if (branch === 'consultant') {
    slots.push({
      key: 'resume',
      label: 'Resume or CV',
      hint: 'A current resume or CV covering your relevant experience.',
      credentialType: 'resume',
      matches: ['resume'],
      required: true,
      acceptsDocx: true,
    })
  }
  slots.push({
    key: 'government_id',
    label: 'Government photo ID',
    hint: "Driver's license, state ID, or passport. Used only to confirm your identity.",
    credentialType: 'government_id',
    matches: ['government_id'],
    required: true,
  })
  return slots
}

export const MALPRACTICE_SLOT: DocSlot = {
  key: 'malpractice',
  label: 'Certificate of insurance',
  hint: 'Certificate of insurance or declarations page showing active coverage.',
  credentialType: 'malpractice_insurance',
  matches: ['malpractice_insurance'],
  required: true,
}

/** Every slot a branch may upload to during onboarding. */
export function uploadableSlotsFor(branch: Branch): DocSlot[] {
  return [...docSlotsFor(branch), MALPRACTICE_SLOT]
}

export const MAX_DOC_BYTES = 10 * 1024 * 1024
// Matches the existing credential upload page (/contractor/credentials/upload).
export const DOC_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]
export const DOCX_MIME = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

/* ───────────── Data shapes passed server → client ───────────── */

export interface DisclosureAnswer {
  answer: YesNo
  details: string
}

export type DisclosuresData = Record<DisclosureKey, DisclosureAnswer>

export function emptyDisclosures(): DisclosuresData {
  return {
    license_action: { answer: '', details: '' },
    exclusion: { answer: '', details: '' },
    conviction: { answer: '', details: '' },
    malpractice: { answer: '', details: '' },
  }
}

export interface CredentialsData {
  /** clinical: name on license; allied: name on certification */
  legal_name: string
  other_names: string
  license_type: string
  specialty: string
  state_license_number: string
  /** YYYY-MM-DD */
  license_issue_date: string
  /** YYYY-MM-DD */
  license_expiration_date: string
  license_states: string[]
  has_compact_license: YesNo
  telehealth_states: string[]
  npi_number: string
  years_of_experience: string
  certification_type: string
  certifying_organization: string
  consulting_background: string
  client_types: string[]
  website_url: string
  primary_background: string
  teaching_topics: string
  ceu_accreditation: '' | 'yes' | 'seeking' | 'no'
  /** practice question (licensed + allied) */
  offers_high_risk_services: YesNo
  self_disclosures: DisclosuresData
}

/** Step 4 liability-insurance answers (metadata lives on the credentials row). */
export interface InsuranceData {
  carries_liability_insurance: YesNo
  /** credentials.issuing_authority */
  carrier: string
  /** credentials.license_number */
  policy_number: string
  /** credentials.coverage_amount */
  coverage_amount: string
  /** credentials.expiration_date, YYYY-MM-DD */
  expiration_date: string
}

export function emptyInsurance(): InsuranceData {
  return {
    carries_liability_insurance: '',
    carrier: '',
    policy_number: '',
    coverage_amount: '',
    expiration_date: '',
  }
}

export interface UploadedDoc {
  id: string
  credential_type: string
  name: string
  document_filename: string | null
  document_url: string | null
  status: string
  /** malpractice: carrier */
  issuing_authority?: string | null
  /** malpractice: policy number */
  license_number?: string | null
  coverage_amount?: string | null
  /** YYYY-MM-DD */
  expiration_date?: string | null
}

export type OfferingKind = 'service' | 'consulting' | 'event'

export interface OfferingDraft {
  kind: OfferingKind
  title: string
  description: string
  format: '' | 'virtual' | 'in_person' | 'home_visit'
  duration_minutes: string
  engagement_type: string
  custom_quote: boolean
  event_type: string
  /** ISO timestamp, or '' when "date later" */
  starts_at: string
  date_later: boolean
  capacity: string
  /** dollars as typed */
  price: string
  is_free: boolean
  /** prescribing, injectables or IVs (services + events; consulting is always false) */
  involves_medical_procedures: boolean
}

export function emptyOffering(kind: OfferingKind): OfferingDraft {
  return {
    kind,
    title: '',
    description: '',
    format: '',
    duration_minutes: kind === 'service' ? '60' : '',
    engagement_type: '',
    custom_quote: false,
    event_type: '',
    starts_at: '',
    date_later: false,
    capacity: '',
    price: '',
    is_free: false,
    involves_medical_procedures: false,
  }
}

export const SERVICE_FORMATS = [
  { value: 'virtual', label: 'Virtual' },
  { value: 'in_person', label: 'In person' },
  { value: 'home_visit', label: 'Home visit' },
] as const

export const ENGAGEMENT_TYPES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'one_time', label: 'One-time session' },
  { value: 'project', label: 'Project-based' },
  { value: 'retainer', label: 'Monthly retainer' },
]

export const EVENT_TYPES = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'ceu_course', label: 'CEU / CME course' },
  { value: 'certification_program', label: 'Certification program' },
  { value: 'class', label: 'Class or group session' },
  { value: 'conference', label: 'Conference or talk' },
]

/* ───────────── Server-side validation (zod) ───────────── */

const STATE_CODES = new Set(US_STATES.map((s) => s.value))

const req = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)

const years = z
  .string()
  .trim()
  .min(1, 'Years is required')
  .regex(/^\d{1,2}$/, 'Enter a whole number of years')
  .transform(Number)
  .pipe(z.number().int().min(0).max(70, 'Enter a number between 0 and 70'))

const shortList = (label: string) =>
  z
    .array(z.string().trim().min(1).max(100))
    .min(1, `Choose at least one ${label}`)
    .max(20)

/** Accepts "example.com" or "linkedin.com/in/x" and normalizes to https://… */
export function normalizeWebsiteUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.') || u.hostname.endsWith('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Today as YYYY-MM-DD (UTC). Good enough for day-granular date checks. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Tomorrow (UTC) — tolerance for "not in the future" across time zones. */
function tomorrowIso(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

const dateField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(isRealDate, `Enter a valid ${label.toLowerCase()}`)

const yesNo = z.enum(['yes', 'no'], { error: 'Choose yes or no' })

const stateList = (msg: string) =>
  z
    .array(z.string())
    .min(1, msg)
    .max(60)
    .refine((a) => a.every((s) => STATE_CODES.has(s)), 'Invalid state')

const disclosure = z.object({
  answer: yesNo,
  details: z
    .string()
    .trim()
    .max(DISCLOSURE_DETAILS_MAX, `Keep this under ${DISCLOSURE_DETAILS_MAX} characters`),
})

/** Practice question + self-disclosures (licensed + allied branches). */
const complianceShape = {
  offers_high_risk_services: yesNo,
  self_disclosures: z.object({
    license_action: disclosure,
    exclusion: disclosure,
    conviction: disclosure,
    malpractice: disclosure,
  }),
}

type ValidatedDisclosures = Record<DisclosureKey, { answer: 'yes' | 'no'; details: string }>

function requireDisclosureDetails(
  v: { self_disclosures: ValidatedDisclosures },
  ctx: z.RefinementCtx
) {
  for (const key of DISCLOSURE_KEYS) {
    const d = v.self_disclosures[key]
    if (d.answer === 'yes' && d.details.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['self_disclosures', key, 'details'],
        message: 'Please explain',
      })
    }
  }
}

export const credentialsSchemas = {
  clinical: z
    .object({
      legal_name: req('Legal name', 150),
      other_names: z.string().trim().max(300, 'Must be 300 characters or fewer'),
      license_type: req('Profession / license type', 100),
      specialty: req('Specialty', 100),
      state_license_number: req('License number', 50),
      license_issue_date: dateField('Issue date'),
      license_expiration_date: dateField('Expiration date'),
      license_states: stateList('Choose at least one licensing state'),
      has_compact_license: yesNo,
      telehealth_states: stateList('Choose at least one state'),
      npi_number: z
        .string()
        .trim()
        .refine(
          (v) => v === '' || isValidNpiFormat(v),
          'Enter a valid 10-digit NPI number'
        ),
      years_of_experience: years,
      ...complianceShape,
    })
    .superRefine((v, ctx) => {
      if (v.license_issue_date > tomorrowIso()) {
        ctx.addIssue({
          code: 'custom',
          path: ['license_issue_date'],
          message: "Issue date can't be in the future",
        })
      }
      if (v.license_expiration_date <= v.license_issue_date) {
        ctx.addIssue({
          code: 'custom',
          path: ['license_expiration_date'],
          message: 'Expiration date must be after the issue date',
        })
      }
      requireDisclosureDetails(v, ctx)
    }),
  allied: z
    .object({
      legal_name: req('Name as it appears on your certification', 150),
      certification_type: req('Certification type', 100),
      certifying_organization: req('Certifying organization', 150),
      specialty: req('Specialty or focus', 100),
      years_of_experience: years,
      ...complianceShape,
    })
    .superRefine(requireDisclosureDetails),
  consultant: z.object({
    specialty: req('Consulting specialty', 100),
    consulting_background: req('Short background', CONSULTING_BACKGROUND_MAX),
    client_types: shortList('client type'),
    years_of_experience: years,
    website_url: z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => v === '' || normalizeWebsiteUrl(v) !== null,
        'Enter a valid URL, like linkedin.com/in/yourname'
      ),
  }),
  educator: z.object({
    primary_background: req('Primary professional background', 150),
    teaching_topics: req('What you teach', 500),
    client_types: shortList('audience'),
    ceu_accreditation: z.enum(['yes', 'seeking', 'no'], {
      error: 'Choose an option',
    }),
  }),
} as const

export { branchHasComplianceQuestions }

/** Convert validated disclosure answers into the self_disclosures JSONB shape. */
export function toSelfDisclosuresJson(
  d: ValidatedDisclosures
): Record<DisclosureKey, { answer: boolean; details: string | null }> {
  const out = {} as Record<DisclosureKey, { answer: boolean; details: string | null }>
  for (const key of DISCLOSURE_KEYS) {
    const yes = d[key].answer === 'yes'
    out[key] = { answer: yes, details: yes ? d[key].details : null }
  }
  return out
}

/* ───────────── Step 2 ───────────── */

export const categoryInputSchema = z
  .object({
    category: z.enum(['clinical', 'allied', 'consultant', 'educator', 'other'], {
      error: 'Choose a category',
    }),
    other_profession: z
      .string()
      .trim()
      .max(OTHER_PROFESSION_MAX, `Must be ${OTHER_PROFESSION_MAX} characters or fewer`),
    credential_basis: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.category !== 'other') return
    if (v.other_profession.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['other_profession'],
        message: 'Tell us your profession',
      })
    }
    if (!['license', 'certification', 'none'].includes(v.credential_basis)) {
      ctx.addIssue({ code: 'custom', path: ['credential_basis'], message: 'Choose an option' })
    }
  })

/* ───────────── Step 4 ───────────── */

export const documentsInputSchema = z
  .object({
    carries_liability_insurance: yesNo,
    carrier: z.string().trim().max(150, 'Must be 150 characters or fewer'),
    policy_number: z.string().trim().max(100, 'Must be 100 characters or fewer'),
    coverage_amount: z.string().trim().max(100, 'Must be 100 characters or fewer'),
    expiration_date: z.string().trim(),
    attest_accurate: z.literal(true, { error: 'Required' }),
    authorize_checks: z.literal(true, { error: 'Required' }),
  })
  .superRefine((v, ctx) => {
    if (v.carries_liability_insurance !== 'yes') return
    if (!v.carrier) {
      ctx.addIssue({ code: 'custom', path: ['carrier'], message: 'Insurance carrier is required' })
    }
    if (!v.policy_number) {
      ctx.addIssue({ code: 'custom', path: ['policy_number'], message: 'Policy number is required' })
    }
    if (!v.coverage_amount) {
      ctx.addIssue({
        code: 'custom',
        path: ['coverage_amount'],
        message: 'Coverage amount is required',
      })
    }
    if (!v.expiration_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiration_date'],
        message: 'Expiration date is required',
      })
    } else if (!isRealDate(v.expiration_date)) {
      ctx.addIssue({ code: 'custom', path: ['expiration_date'], message: 'Enter a valid date' })
    } else if (v.expiration_date < todayIso()) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiration_date'],
        message: 'This policy has already expired',
      })
    }
  })

const dollars = z
  .string()
  .trim()
  .regex(/^\d{1,6}(\.\d{1,2})?$/, 'Enter a price in dollars, like 120 or 89.50')
  .transform((v) => Math.round(Number(v) * 100))

export const offeringSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('service'),
    title: req('Service name', 120),
    description: z.string().trim().max(1000),
    format: z.enum(['virtual', 'in_person', 'home_visit'], {
      error: 'Choose a format',
    }),
    price: dollars,
    involves_medical_procedures: z.boolean().default(false),
    duration_minutes: z
      .string()
      .trim()
      .regex(/^\d{1,4}$/, 'Enter a duration in minutes')
      .transform(Number)
      .pipe(z.number().int().min(5, 'At least 5 minutes').max(1440)),
  }),
  z
    .object({
      kind: z.literal('consulting'),
      title: req('Consulting area', 120),
      description: z.string().trim().max(1000),
      engagement_type: z.enum(
        ['hourly', 'one_time', 'project', 'retainer'],
        { error: 'Choose an engagement type' }
      ),
      custom_quote: z.boolean(),
      price: z.string().trim(),
    })
    .superRefine((v, ctx) => {
      if (!v.custom_quote && !dollars.safeParse(v.price).success) {
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: 'Enter a starting rate, or choose "I send custom quotes"',
        })
      }
    }),
  z
    .object({
      kind: z.literal('event'),
      event_type: z.enum(
        EVENT_TYPES.map((e) => e.value) as [string, ...string[]],
        { error: 'Choose an event type' }
      ),
      title: req('Event title', 120),
      description: z.string().trim().max(2000),
      date_later: z.boolean(),
      starts_at: z.string().trim(),
      capacity: z
        .string()
        .trim()
        .refine((v) => v === '' || /^\d{1,5}$/.test(v), 'Enter a number')
        .refine((v) => v === '' || Number(v) >= 1, 'At least 1 attendee'),
      is_free: z.boolean(),
      price: z.string().trim(),
      involves_medical_procedures: z.boolean().default(false),
    })
    .superRefine((v, ctx) => {
      if (!v.date_later) {
        const t = Date.parse(v.starts_at)
        if (!v.starts_at || Number.isNaN(t)) {
          ctx.addIssue({
            code: 'custom',
            path: ['starts_at'],
            message: 'Pick a date, or choose "I\'ll set the date later"',
          })
        }
      }
      if (!v.is_free && !dollars.safeParse(v.price).success) {
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: 'Enter a price, or mark the event as free',
        })
      }
    }),
])

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export function firstErrors(
  issues: { path: PropertyKey[]; message: string }[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const key = i.path.map(String).join('.')
    if (key && !out[key]) out[key] = i.message
  }
  return out
}
