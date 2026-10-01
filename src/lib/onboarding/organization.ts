// Organization onboarding options (Organization Onboarding spec). Shared by
// /signup/organization (step 1), the /onboarding/organization wizard
// (steps 2-4), the admin review page and the server actions, so stored keys
// never drift from the UI. Stored in facility_profiles
// (20261001000600_org_onboarding.sql).

/** Steps shown in the wizard progress bar (step 1 is the signup page). */
export const ORG_TOTAL_STEPS = 5
export type OrgWizardStep = 2 | 3 | 4 | 5

export const ORG_DESCRIPTION_MAX = 300
export const ORG_TYPE_OTHER_MAX = 100
export const DISCLOSURE_DETAILS_MAX = 2000

/**
 * Step 2 organization types. `enumValue` is the closest legacy
 * `facility_type` enum value (still NOT NULL on facility_profiles).
 */
export const ORG_TYPES = [
  { value: 'hospital', label: 'Hospital or health system', enumValue: 'hospital' },
  { value: 'clinic', label: 'Clinic or medical practice', enumValue: 'clinic' },
  { value: 'urgent_care', label: 'Urgent care or ambulatory surgery center', enumValue: 'urgent_care' },
  { value: 'nursing_home', label: 'Nursing home or long-term care', enumValue: 'nursing_home' },
  { value: 'home_health', label: 'Home health or hospice agency', enumValue: 'home_health' },
  { value: 'telehealth', label: 'Telehealth company', enumValue: 'telehealth' },
  { value: 'med_spa', label: 'Med spa, aesthetics, or wellness/longevity center', enumValue: 'other' },
  { value: 'gym', label: 'Gym or fitness studio', enumValue: 'other' },
  { value: 'school', label: 'School, university, or training program', enumValue: 'other' },
  { value: 'nonprofit', label: 'Nonprofit, community, or public health organization', enumValue: 'other' },
  { value: 'employer', label: 'Corporate employer (wellness programs)', enumValue: 'other' },
  { value: 'law_firm', label: 'Law firm', enumValue: 'other' },
  { value: 'startup', label: 'Healthcare startup or tech company', enumValue: 'other' },
  { value: 'staffing', label: 'Staffing or recruiting firm', enumValue: 'staffing_agency' },
  { value: 'government', label: 'Government agency', enumValue: 'other' },
  { value: 'other', label: 'Other', enumValue: 'other' },
] as const

export type OrgTypeKey = (typeof ORG_TYPES)[number]['value']
export const ORG_TYPE_KEYS = ORG_TYPES.map((t) => t.value) as [OrgTypeKey, ...OrgTypeKey[]]

export function orgTypeLabel(key: string | null | undefined, other?: string | null): string | null {
  if (!key) return null
  if (key === 'other') return other?.trim() || 'Other'
  return ORG_TYPES.find((t) => t.value === key)?.label ?? key
}

export function facilityTypeEnumFor(key: OrgTypeKey): string {
  return ORG_TYPES.find((t) => t.value === key)?.enumValue ?? 'other'
}

export const ORG_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const
export type OrgSize = (typeof ORG_SIZES)[number]

export const BUSINESS_STRUCTURES = [
  { value: 'llc', label: 'LLC' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'government', label: 'Government' },
  { value: 'sole_proprietor', label: 'Sole proprietor' },
  { value: 'other', label: 'Other' },
] as const
export type BusinessStructure = (typeof BUSINESS_STRUCTURES)[number]['value']
export const BUSINESS_STRUCTURE_KEYS = BUSINESS_STRUCTURES.map((b) => b.value) as [
  BusinessStructure,
  ...BusinessStructure[],
]

/** Step 3 self-disclosures. A "yes" needs an explanation. */
export const ORG_DISCLOSURES = [
  {
    key: 'license_action',
    question:
      "Has your organization's license ever been suspended, revoked, restricted, or investigated?",
  },
  { key: 'exclusion', question: 'Is your organization excluded from Medicare or Medicaid?' },
  {
    key: 'workforce_action',
    question:
      'In the last 5 years, has your organization been the subject of a state or federal action over staffing or workforce practices?',
  },
] as const
export type OrgDisclosureKey = (typeof ORG_DISCLOSURES)[number]['key']
export type OrgDisclosures = Partial<
  Record<OrgDisclosureKey, { answer: boolean; details?: string | null }>
>

export const ATTEST_AUTHORIZED_LABEL =
  "I'm authorized to represent this organization, and the information I provided is accurate."
export const ATTEST_CHECKS_LABEL =
  'I authorize Sanus to verify this information and run exclusion screenings.'
export const REVIEW_NOTE = 'We review every application within 24-48 hours.'

/** Step 3 uploads. */
export const ORG_DOCUMENT_KINDS = [
  {
    kind: 'facility_license',
    label: 'Facility license',
    help: 'Only if you hold a facility or operating license.',
  },
  {
    kind: 'business_registration',
    label: 'Business license or Secretary of State registration',
    help: 'A PDF or photo of your registration or business license.',
  },
] as const
export type OrgDocumentKind = (typeof ORG_DOCUMENT_KINDS)[number]['kind']

/** Step 4. They can change these any time from their profile. */
export const ORG_INTENTS = [
  {
    key: 'advertise_services',
    label: 'Advertise our services',
    sub: 'List what you offer so individuals and businesses can book or inquire.',
  },
  {
    key: 'host_events',
    label: 'Host events and trainings',
    sub: 'Webinars, workshops, CEU courses, health fairs, and more.',
  },
  {
    key: 'find_professionals',
    label: 'Find professionals to work with us',
    sub: 'Browse, send inquiries, and invite people to join your team.',
  },
  {
    key: 'post_needs',
    label: 'Post an urgent need or staffing opportunity',
    sub: 'Professionals apply and you review.',
  },
] as const
export type OrgIntent = (typeof ORG_INTENTS)[number]['key']
export const ORG_INTENT_KEYS = ORG_INTENTS.map((i) => i.key) as [OrgIntent, ...OrgIntent[]]

/** Free email providers — Step 1 nudges toward a work address. */
export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com',
  'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me',
  'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com', 'comcast.net',
  'att.net', 'verizon.net', 'sbcglobal.net',
])

export function isFreeEmail(email: string): boolean {
  const domain = email.split('@')[1]?.trim().toLowerCase() ?? ''
  return FREE_EMAIL_DOMAINS.has(domain)
}

/* ───────────── Step 5: Quick setup ───────────── */

/**
 * Staffing posts (section D) stay off until the legal questions in the spec
 * ("Settle with an attorney before building staffing posts": worker
 * classification, nurse registry rules, pay transparency) are settled.
 * Turn on with NEXT_PUBLIC_STAFFING_POSTS_ENABLED=true.
 */
export const STAFFING_POSTS_ENABLED = process.env.NEXT_PUBLIC_STAFFING_POSTS_ENABLED === 'true'

/** Shown on every staffing post and its form. */
export const NOT_EMPLOYER_NOTICE =
  'Sanus connects organizations and professionals. Sanus isn’t the employer or a staffing agency and doesn’t handle pay, scheduling, or employment — the organization and professional arrange those directly.'

export const SERVICE_AUDIENCES = [
  { value: 'individuals', label: 'Individuals' },
  { value: 'businesses', label: 'Businesses' },
  { value: 'professionals', label: 'Other professionals' },
] as const

export const LISTING_FORMATS = [
  { value: 'in_person', label: 'In-person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'home_visit', label: 'Home visit' },
] as const

export const EVENT_FORMATS = [
  { value: 'in_person', label: 'In-person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hybrid', label: 'Hybrid' },
] as const

export const REACH_VIA = [
  { value: 'book', label: 'Book on Sanus' },
  { value: 'inquiry', label: 'Send an inquiry' },
] as const

export const ORG_EVENT_TYPES = [
  { value: 'webinar', label: 'Webinar' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'ceu_course', label: 'CEU/CME course' },
  { value: 'certification', label: 'Certification' },
  { value: 'conference', label: 'Conference' },
  { value: 'health_fair', label: 'Health fair' },
  { value: 'support_group', label: 'Support group' },
] as const

export const EVENT_AUDIENCES = [
  { value: 'public', label: 'The public' },
  { value: 'professionals', label: 'Professionals' },
  { value: 'staff', label: 'Our own staff' },
] as const

/** Same tiers as professional signup. */
export const PROFESSIONAL_TIERS = [
  { value: 'clinical', label: 'Licensed clinical' },
  { value: 'allied', label: 'Allied or certified' },
  { value: 'consultant', label: 'Healthcare consultant' },
  { value: 'educator', label: 'Educator or trainer' },
  { value: 'other', label: 'Other' },
] as const

export const LOOKING_FOR_ENGAGEMENTS = [
  { value: 'employee', label: 'Employee' },
  { value: 'independent_contractor', label: 'Independent contractor' },
  { value: 'per_diem', label: 'Per diem' },
  { value: 'consulting_project', label: 'Consulting project' },
  { value: 'volunteer', label: 'Volunteer' },
] as const

export const WORK_SETTINGS = [
  { value: 'on_site', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
] as const

export const HIRING_TIMELINES = [
  { value: 'immediately', label: 'Immediately' },
  { value: 'within_month', label: 'Within a month' },
  { value: 'exploring', label: 'Just exploring' },
] as const

export const STAFFING_POST_TYPES = [
  { value: 'surge', label: 'Surge or pop-up event' },
  { value: 'staffing_shortage', label: 'Staffing shortage' },
  { value: 'ongoing_role', label: 'Ongoing role' },
  { value: 'short_term_project', label: 'Short-term project' },
] as const

export const STAFFING_ENGAGEMENTS = [
  { value: 'employee', label: 'Employee' },
  { value: 'independent_contractor', label: 'Independent contractor' },
  { value: 'volunteer', label: 'Volunteer' },
] as const

export const PAY_UNITS = [
  { value: 'hourly', label: 'per hour' },
  { value: 'daily', label: 'per day' },
  { value: 'flat', label: 'flat' },
  { value: 'salary', label: 'per year (salary)' },
] as const

export const MAX_SCREENING_QUESTIONS = 3

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined
): string {
  return options.find((o) => o.value === value)?.label ?? value ?? ''
}
