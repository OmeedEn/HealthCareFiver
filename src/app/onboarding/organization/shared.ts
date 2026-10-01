import { z } from 'zod'
import {
  BUSINESS_STRUCTURE_KEYS,
  DISCLOSURE_DETAILS_MAX,
  ORG_DESCRIPTION_MAX,
  ORG_DISCLOSURES,
  ORG_INTENT_KEYS,
  ORG_SIZES,
  ORG_TYPE_KEYS,
  ORG_TYPE_OTHER_MAX,
  type OrgDocumentKind,
} from '@/lib/onboarding/organization'

/* ───────────── Step 2: About your organization ───────────── */

export interface AboutData {
  facility_name: string
  org_type: string
  org_type_other: string
  org_size: string
  city: string
  state: string
  zip_code: string
  location_count: string
  website: string
  phone: string
  description: string
}

export const aboutSchema = z
  .object({
    facility_name: z.string().trim().min(1, 'Organization name is required').max(200),
    org_type: z.enum(ORG_TYPE_KEYS, 'Choose your organization type'),
    org_type_other: z.string().trim().max(ORG_TYPE_OTHER_MAX).default(''),
    org_size: z.enum(ORG_SIZES, 'Choose your organization size'),
    city: z.string().trim().min(1, 'City is required').max(100),
    state: z.string().trim().regex(/^[A-Z]{2}$/, 'Choose a state'),
    zip_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
    location_count: z.coerce
      .number({ error: 'Enter the number of locations' })
      .int('Enter a whole number')
      .min(1, 'At least 1 location')
      .max(10000),
    website: z
      .string()
      .trim()
      .min(1, 'Website is required')
      .max(300)
      .refine((v) => /^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(v), 'Enter a valid website'),
    phone: z.string().trim().min(1, 'Organization phone is required'),
    description: z
      .string()
      .trim()
      .min(1, 'Add a short description')
      .max(ORG_DESCRIPTION_MAX, `Keep it to ${ORG_DESCRIPTION_MAX} characters`),
  })
  .refine((d) => d.org_type !== 'other' || d.org_type_other.length > 0, {
    path: ['org_type_other'],
    message: 'Tell us what kind of organization you are',
  })

/* ───────────── Step 3: Verify your organization ───────────── */

export type YesNo = '' | 'yes' | 'no'

export interface VerifyData {
  legal_name: string
  business_structure: string
  registration_state: string
  has_facility_license: YesNo
  facility_license_type: string
  facility_license_number: string
  facility_license_agency: string
  facility_license_expires: string
  org_npi: string
  disclosures: Record<string, { answer: YesNo; details: string }>
  attest_authorized: boolean
  attest_checks: boolean
}

const yesNo = z.enum(['yes', 'no'], 'Answer yes or no')

export const verifySchema = z
  .object({
    legal_name: z.string().trim().max(200).default(''),
    business_structure: z.enum(BUSINESS_STRUCTURE_KEYS, 'Choose a business structure'),
    registration_state: z.string().trim().regex(/^[A-Z]{2}$/, 'Choose the state of registration'),
    has_facility_license: yesNo,
    facility_license_type: z.string().trim().max(200).default(''),
    facility_license_number: z.string().trim().max(100).default(''),
    facility_license_agency: z.string().trim().max(200).default(''),
    facility_license_expires: z.string().trim().default(''),
    org_npi: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{10}$/.test(v), 'An NPI is 10 digits')
      .default(''),
    disclosures: z.record(
      z.string(),
      z.object({ answer: yesNo, details: z.string().trim().max(DISCLOSURE_DETAILS_MAX).default('') })
    ),
    attest_authorized: z.literal(true, 'Please confirm you’re authorized and the information is accurate'),
    attest_checks: z.literal(true, 'Please authorize verification and exclusion screenings'),
  })
  .superRefine((d, ctx) => {
    if (d.has_facility_license === 'yes') {
      const req: [keyof typeof d, string][] = [
        ['facility_license_type', 'License type is required'],
        ['facility_license_number', 'License number is required'],
        ['facility_license_agency', 'Issuing agency is required'],
        ['facility_license_expires', 'Expiration date is required'],
      ]
      for (const [key, message] of req) {
        if (!String(d[key] ?? '').trim()) ctx.addIssue({ code: 'custom', path: [key], message })
      }
      if (d.facility_license_expires && !/^\d{4}-\d{2}-\d{2}$/.test(d.facility_license_expires)) {
        ctx.addIssue({ code: 'custom', path: ['facility_license_expires'], message: 'Enter a valid date' })
      }
    }
    for (const q of ORG_DISCLOSURES) {
      const a = d.disclosures[q.key]
      if (!a) {
        ctx.addIssue({ code: 'custom', path: ['disclosures', q.key], message: 'Answer yes or no' })
      } else if (a.answer === 'yes' && !a.details) {
        ctx.addIssue({ code: 'custom', path: ['disclosures', q.key], message: 'Please explain' })
      }
    }
  })

export interface OrgDoc {
  id: string
  kind: OrgDocumentKind
  filename: string
  storage_path: string
}

export const DOC_ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]
export const DOC_MAX_BYTES = 10 * 1024 * 1024

/* ───────────── Step 4: Intents ───────────── */

export const intentsSchema = z
  .array(z.enum(ORG_INTENT_KEYS))
  .min(1, 'Pick at least one — you can change this anytime')

/** First validation message per field, for inline errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
