/**
 * Shared types, copy and validation for /onboarding/professional (steps 2–5).
 * Imported by both the server page/actions and the client step components,
 * so it must stay free of server-only dependencies.
 */
import { z } from 'zod'
import { US_STATES } from '@/lib/utils/constants'
import { isValidNpiFormat } from '@/lib/integrations/npi-registry'

export type ProCategory = 'clinical' | 'allied' | 'consultant' | 'educator'
export type WizardStep = 2 | 3 | 4 | 5

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
]

export const PRICE_FEE_NOTE =
  "Sanus charges a small service fee on bookings. You'll see the exact amount before you publish."

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

export function docSlotsFor(category: ProCategory): DocSlot[] {
  const slots: DocSlot[] = []
  if (category !== 'consultant') {
    const isClinical = category === 'clinical'
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
  if (category === 'clinical') {
    slots.push({
      key: 'malpractice',
      label: 'Proof of malpractice insurance',
      hint: 'Certificate of insurance or declarations page showing active coverage.',
      credentialType: 'malpractice_insurance',
      matches: ['malpractice_insurance'],
      required: true,
    })
  }
  if (category === 'consultant') {
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

export interface CredentialsData {
  license_type: string
  specialty: string
  state_license_number: string
  license_states: string[]
  npi_number: string
  years_of_experience: string
  certification_type: string
  certifying_organization: string
  certification_number: string
  consulting_background: string
  client_types: string[]
  website_url: string
  primary_background: string
  teaching_topics: string
  ceu_accreditation: '' | 'yes' | 'seeking' | 'no'
}

export interface UploadedDoc {
  id: string
  credential_type: string
  name: string
  document_filename: string | null
  document_url: string | null
  status: string
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

export const credentialsSchemas = {
  clinical: z.object({
    license_type: req('Profession / license type', 100),
    specialty: req('Specialty', 100),
    state_license_number: req('License number', 50),
    license_states: z
      .array(z.string())
      .min(1, 'Choose at least one licensing state')
      .max(60)
      .refine((a) => a.every((s) => STATE_CODES.has(s)), 'Invalid state'),
    npi_number: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || isValidNpiFormat(v),
        'Enter a valid 10-digit NPI number'
      ),
    years_of_experience: years,
  }),
  allied: z.object({
    certification_type: req('Certification type', 100),
    certifying_organization: req('Certifying organization', 150),
    certification_number: req('Certification number or ID', 50),
    specialty: req('Specialty or focus', 100),
    years_of_experience: years,
  }),
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
