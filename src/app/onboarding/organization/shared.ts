import { z } from 'zod'
import {
  BUSINESS_STRUCTURE_KEYS,
  DISCLOSURE_DETAILS_MAX,
  ORG_DESCRIPTION_MAX,
  ORG_INTENT_KEYS,
  ORG_SIZES,
  ORG_TYPE_KEYS,
  ORG_TYPE_OTHER_MAX,
  orgTypeLabel,
  orgTypesForPath,
  type OrgDocumentKind,
  type OrgIntent,
} from '@/lib/onboarding/organization'
import { isOrgSignupPath, type OrgSignupPath } from '@/lib/onboarding/signup-path'

export { asksFacilityLicense } from '@/lib/onboarding/questions/organization'

/**
 * Cross-field checks run even when other fields fail, so people see every
 * problem at once instead of fixing errors in rounds. The callbacks may see
 * partially-invalid input, so they guard every field.
 */
const ALWAYS = { when: () => true }

/* ───────────── Signup door ───────────── */

/**
 * The door an org account came through (profiles.signup_path). Legacy
 * accounts (null) and anything unexpected act like HIRING: both type lists
 * and the facility license question.
 */
export function orgDoorFor(signupPath: string | null | undefined): OrgSignupPath {
  return isOrgSignupPath(signupPath) ? signupPath : 'HIRING'
}

/** "What do you want to do first?" cards pre-highlighted by door (spec). */
export const DEFAULT_INTENTS: Record<OrgSignupPath, OrgIntent[]> = {
  PRACTICE: ['advertise_services'],
  COMPANY: ['advertise_services', 'host_events'],
  HIRING: ['find_professionals'],
}

export function isOrgTypeAllowed(door: OrgSignupPath, orgType: string): boolean {
  return orgTypesForPath(door).some((t) => t.value === orgType)
}

export const ORG_TYPE_NOT_OFFERED = 'Choose one of the listed organization types'

/**
 * Screen 1 options for a door. A saved type that isn't offered for this
 * door (e.g. legacy 'startup') stays visible so the answer doesn't go
 * blank, but saving asks them to pick one from the list.
 */
export function orgTypeOptionsFor(door: OrgSignupPath, current: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = orgTypesForPath(door).map((t) => ({
    value: t.value,
    label: t.label,
  }))
  if (current && !options.some((o) => o.value === current)) {
    options.unshift({ value: current, label: `${orgTypeLabel(current) ?? current} (no longer offered)` })
  }
  return options
}

/* ───────────── Organization answers (onboarding + Finish your profile) ───────────── */

export type YesNo = '' | 'yes' | 'no'

/** Loose "looks like a URL" check; the scheme is optional (we add https://). */
export const URL_LIKE = /^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/i

export function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

const STATE = /^[A-Z]{2}$/
const optionalText = (max: number) => z.string().trim().max(max, `Keep it to ${max} characters`)
const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Keep it to ${max} characters`)

export const DISCLOSURE_KEYS = ['license_action', 'exclusion', 'workforce_action'] as const

/**
 * Per-field rules for every organization answer, so each single-question
 * screen (onboarding or a dashboard item) checks and saves just its own
 * fields. Values are what the screens hold (strings, 'yes'/'no', booleans).
 */
export const orgFieldRules = {
  org_type: z.enum(ORG_TYPE_KEYS, 'Choose your organization type'),
  org_type_other: optionalText(ORG_TYPE_OTHER_MAX),
  facility_name: requiredText('Organization name', 200),
  website: z
    .string()
    .trim()
    .max(300, 'Keep the link under 300 characters')
    .refine((v) => v === '' || URL_LIKE.test(v), 'Enter a valid website, like yourorganization.com'),
  has_no_website: z.boolean(),
  city: requiredText('City', 100),
  state: z.string().trim().regex(STATE, 'Choose a state'),
  has_facility_license: z.enum(['yes', 'no'], 'Answer yes or no'),
  facility_license_type: requiredText('License type', 200),
  facility_license_number: requiredText('License number', 100),
  facility_license_agency: requiredText('Issuing agency', 200),
  facility_license_expires: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date'),
  lead_has_credential: z.enum(['yes', 'no'], 'Answer yes or no'),
  lead_credential_type: requiredText('License or certification type', 200),
  lead_credential_number: requiredText('License or certification number', 100),
  lead_credential_state: z.string().trim().regex(STATE, 'Choose a state'),
  lead_linkedin: z
    .string()
    .trim()
    .max(300, 'Keep the link under 300 characters')
    .refine((v) => v === '' || URL_LIKE.test(v), 'Enter a valid link, like linkedin.com/in/name'),
  org_size: z.enum(ORG_SIZES, 'Choose your organization size'),
  zip_code: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{5}(-\d{4})?$/.test(v), 'Enter a 5-digit ZIP code'),
  location_count: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d{1,5}$/.test(v) && Number(v) >= 1 && Number(v) <= 10000),
      'Enter a number from 1 to 10,000'
    ),
  phone: z.string().trim().max(32),
  description: optionalText(ORG_DESCRIPTION_MAX),
  legal_name: optionalText(200),
  business_structure: z.enum(BUSINESS_STRUCTURE_KEYS, 'Choose a business structure'),
  registration_state: z.string().trim().regex(STATE, 'Choose the state of registration'),
  org_npi: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{10}$/.test(v), 'An NPI is 10 digits'),
  contact_title: optionalText(100),
  /** "Do any of these apply to your organization?" — picked keys plus one shared explanation. */
  disclosures: z.object({
    picked: z.array(z.enum(DISCLOSURE_KEYS)).max(3),
    details: z.string().trim().max(DISCLOSURE_DETAILS_MAX, `Keep it to ${DISCLOSURE_DETAILS_MAX} characters`),
  }),
}

export type OrgFieldKey = keyof typeof orgFieldRules
export type OrgFieldInput = Partial<{ [K in OrgFieldKey]: z.input<(typeof orgFieldRules)[K]> }>

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

/* ───────────── What they want to do first ───────────── */

export const intentsSchema = z
  .array(z.enum(ORG_INTENT_KEYS))
  .min(1, 'Pick at least one — you can change this anytime')

/**
 * Validate just `keys` of `data` against a field map and return the first
 * message per field. Empty = all good.
 */
export function checkFields<F extends z.ZodRawShape>(
  fields: F,
  keys: (keyof F & string)[],
  data: Record<string, unknown>
): Record<string, string> {
  const shape = Object.fromEntries(keys.map((k) => [k, fields[k]])) as z.ZodRawShape
  const res = z.object(shape).safeParse(data)
  return res.success ? {} : fieldErrors(res.error)
}

/** First validation message per field, for inline errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/* ───────────── Setup from the first-run cards ───────────── */

const money = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Enter an amount like 75 or 75.50')

export interface ServiceDraft {
  title: string
  description: string
  audiences: string[]
  format: string
  locations: string
  price: string
  contact_for_pricing: boolean
  reach_via: string
}

export const serviceSchema = z
  .object({
    title: z.string().trim().min(1, 'Service name is required').max(200),
    description: z.string().trim().min(1, 'Add a short description').max(5000),
    audiences: z.array(z.enum(['individuals', 'businesses', 'professionals'])).min(1, 'Pick who it’s for'),
    format: z.enum(['in_person', 'virtual', 'home_visit'], 'Choose a format'),
    locations: z.string().trim().max(500).default(''),
    price: money.default(''),
    contact_for_pricing: z.boolean(),
    reach_via: z.enum(['book', 'inquiry'], 'Choose how people reach you'),
  })
  .superRefine((d, ctx) => {
    if (!d?.contact_for_pricing && !d?.price) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Add a price, or choose “Contact us for pricing”' })
    }
    if (d?.format && d.format !== 'virtual' && !d.locations) {
      ctx.addIssue({ code: 'custom', path: ['locations'], message: 'Add where it’s offered' })
    }
  }, ALWAYS)

export interface EventDraft {
  event_type: string
  title: string
  description: string
  date_later: boolean
  starts_at: string
  format: string
  locations: string
  capacity: string
  is_free: boolean
  price: string
  offers_ceu: YesNo
  audiences: string[]
}

export const eventSchema = z
  .object({
    event_type: z.enum(
      ['webinar', 'workshop', 'ceu_course', 'certification', 'conference', 'health_fair', 'support_group'],
      'Choose the event type'
    ),
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().min(1, 'Add a short description').max(5000),
    date_later: z.boolean(),
    starts_at: z.string().trim().default(''),
    format: z.enum(['in_person', 'virtual', 'hybrid'], 'Choose a format'),
    locations: z.string().trim().max(500).default(''),
    capacity: z.string().trim().refine((v) => v === '' || /^\d+$/.test(v), 'Enter a number').default(''),
    is_free: z.boolean(),
    price: money.default(''),
    offers_ceu: z.enum(['yes', 'no'], 'Answer yes or no'),
    audiences: z.array(z.enum(['public', 'professionals', 'staff'])).min(1, 'Pick the audience'),
  })
  .superRefine((d, ctx) => {
    if (!d?.date_later && !d?.starts_at) {
      ctx.addIssue({ code: 'custom', path: ['starts_at'], message: 'Pick a date and time, or “Set up later”' })
    }
    if (!d?.is_free && !d?.price) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Add a price, or mark it free' })
    if (d?.format && d.format !== 'virtual' && !d.locations) {
      ctx.addIssue({ code: 'custom', path: ['locations'], message: 'Add the location' })
    }
  }, ALWAYS)

export interface LookingForData {
  types: string[]
  specialties: string
  engagement_types: string[]
  settings: string[]
  timeline: string
  license_states: string[]
  min_years: string
}

export const lookingForSchema = z.object({
  types: z.array(z.enum(['clinical', 'allied', 'consultant', 'educator', 'other'])).min(1, 'Pick at least one'),
  specialties: z.string().trim().max(500).default(''),
  engagement_types: z
    .array(z.enum(['employee', 'independent_contractor', 'per_diem', 'consulting_project', 'volunteer']))
    .min(1, 'Pick at least one'),
  settings: z.array(z.enum(['on_site', 'remote', 'hybrid'])).min(1, 'Pick at least one'),
  timeline: z.enum(['immediately', 'within_month', 'exploring'], 'Choose a timeline'),
  license_states: z.array(z.string().regex(/^[A-Z]{2}$/)).max(60).default([]),
  min_years: z.string().trim().refine((v) => v === '' || /^\d{1,2}$/.test(v), 'Enter years').default(''),
})

export interface StaffingDraft {
  title: string
  post_type: string
  needs: { type: string; count: string }[]
  is_ongoing: boolean
  start_date: string
  end_date: string
  schedule: string
  city: string
  state: string
  zip_code: string
  is_remote: boolean
  engagement_type: string
  is_volunteer: boolean
  pay_min: string
  pay_max: string
  pay_unit: string
  requirements: string
  min_years: string
  description: string
  screening_questions: string[]
  application_deadline: string
  is_urgent: boolean
  reviewer_emails: string
  applicant_cap: string
}

export const staffingSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    post_type: z.enum(['surge', 'staffing_shortage', 'ongoing_role', 'short_term_project'], 'Choose the type'),
    needs: z
      .array(
        z.object({
          type: z.enum(['clinical', 'allied', 'consultant', 'educator', 'other'], 'Choose a type'),
          count: z.string().trim().regex(/^\d{1,4}$/, 'How many?'),
        })
      )
      .min(1, 'Add at least one professional type'),
    is_ongoing: z.boolean(),
    start_date: z.string().trim().default(''),
    end_date: z.string().trim().default(''),
    schedule: z.string().trim().min(1, 'Describe the schedule').max(500),
    city: z.string().trim().min(1, 'City is required').max(100),
    state: z.string().trim().regex(/^[A-Z]{2}$/, 'Choose a state'),
    zip_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
    is_remote: z.boolean(),
    engagement_type: z.enum(['employee', 'independent_contractor', 'volunteer'], 'Choose the engagement type'),
    is_volunteer: z.boolean(),
    pay_min: money.default(''),
    pay_max: money.default(''),
    pay_unit: z.string().default(''),
    requirements: z.string().trim().max(2000).default(''),
    min_years: z.string().trim().refine((v) => v === '' || /^\d{1,2}$/.test(v), 'Enter years').default(''),
    description: z.string().trim().min(1, 'Add a description').max(5000),
    screening_questions: z.array(z.string().trim().max(300)).max(3, 'Up to 3 questions').default([]),
    application_deadline: z.string().trim().default(''),
    is_urgent: z.boolean(),
    reviewer_emails: z.string().trim().max(1000).default(''),
    applicant_cap: z.string().trim().refine((v) => v === '' || /^\d{1,4}$/.test(v), 'Enter a number').default(''),
  })
  .superRefine((d, ctx) => {
    if (!d?.is_ongoing && !d?.start_date) {
      ctx.addIssue({ code: 'custom', path: ['start_date'], message: 'Add a start date, or mark it ongoing' })
    }
    // Pay is required (California pay transparency), unless it's volunteer.
    if (!d?.is_volunteer) {
      if (!d?.pay_min) ctx.addIssue({ code: 'custom', path: ['pay_min'], message: 'Pay is required — or mark it volunteer' })
      if (!['hourly', 'daily', 'flat', 'salary'].includes(d?.pay_unit ?? '')) {
        ctx.addIssue({ code: 'custom', path: ['pay_unit'], message: 'Choose a pay unit' })
      }
      if (d?.pay_max && d?.pay_min && Number(d.pay_max) < Number(d.pay_min)) {
        ctx.addIssue({ code: 'custom', path: ['pay_max'], message: 'Max must be at least the min' })
      }
    }
    const emails = (d?.reviewer_emails ?? '').split(/[\s,]+/).filter(Boolean)
    if (emails.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
      ctx.addIssue({ code: 'custom', path: ['reviewer_emails'], message: 'Check the email addresses' })
    }
  }, ALWAYS)

export function toCents(v: string): number | null {
  return v ? Math.round(Number(v) * 100) : null
}
