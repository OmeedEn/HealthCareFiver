// Organization flow, as configuration (Single-Question Onboarding spec,
// "Organization: /signup/organization"). One entry per screen: id (the key
// stored in onboarding_progress), the exact question text, and the flags the
// screens read. Reword or reorder here; the screens in
// src/app/(flow)/signup/organization and src/app/onboarding/organization
// render from it. Pure: safe on server and client.

import type { OrgSignupPath } from '@/lib/onboarding/signup-path'

export interface OrgQuestion {
  id: string
  text: string
  sub?: string
  whyWeAsk?: string
  helper?: string
  placeholder?: string
  skippable?: boolean
  continueLabel?: string
}

export const ORG_QUESTIONS = {
  /** 1 — pre-account (asked post-account for staff-assigned accounts). */
  type: {
    id: 'org_type',
    text: 'What type of organization are you?',
  },
  /** 2 — pre-account (same). */
  name: {
    id: 'org_name',
    text: 'What’s your organization’s name?',
    sub: 'The name the public knows.',
    placeholder: 'e.g. Sunrise Family Clinic',
  },
  /** 3 — the account screen (the only multi-field screen). */
  account: {
    id: 'account',
    text: 'Create your account',
    helper: 'Use your work email if you can.',
    continueLabel: 'Create account',
  },
  /** 4 */
  website: {
    id: 'org_website',
    text: 'What’s your organization’s website?',
    sub: 'We use this to verify the business.',
    placeholder: 'yourorganization.com',
  },
  /** 5 */
  location: {
    id: 'org_location',
    text: 'Which city and state are you in?',
    sub: 'Your main location or headquarters.',
    whyWeAsk: 'The state tells us where to look up your registration.',
  },
  /** 6, Practice and Hiring. */
  facilityLicense: {
    id: 'license',
    text: 'Does your organization hold a facility or operating license?',
    whyWeAsk: 'We check it with the state agency that issued it.',
  },
  /** 6, Company. */
  leadCredential: {
    id: 'license',
    text: 'Does the lead person at your company hold a professional license or certification?',
    whyWeAsk: 'We check it with the board or state that issued it.',
  },
  /** 6, follow-up when they answer yes (Practice/Hiring: type, number, issuing agency). */
  facilityLicenseDetails: {
    id: 'license_details',
    text: 'Tell us about the license',
    whyWeAsk: 'We check it with the state agency that issued it.',
  },
  /** 6, follow-up when they answer yes (Company: type, number, state). */
  leadCredentialDetails: {
    id: 'license_details',
    text: 'Tell us about their license or certification',
    whyWeAsk: 'We check it with the board or state that issued it.',
  },
  /** 7 */
  registration: {
    id: 'registration_doc',
    text: 'Upload a document that shows your organization is registered',
    sub: 'A facility license, business license, or Secretary of State registration.',
    whyWeAsk: 'Private and encrypted. Only our review team sees it.',
    skippable: true,
  },
  /** 8 */
  submit: {
    id: 'submit',
    text: 'Confirm and submit',
    continueLabel: 'Submit my application',
  },
} satisfies Record<string, OrgQuestion>

export const NO_WEBSITE_LABEL = 'We don’t have a website'

/** Practice and Hiring answer the facility license question; Company answers the lead person's. */
export function asksFacilityLicense(door: OrgSignupPath): boolean {
  return door !== 'COMPANY'
}

/** What a resume decision needs to know about an organization (facility_profiles + documents). */
export interface OrgFlowData {
  org_type: string | null
  org_type_other: string | null
  facility_name: string | null
  website: string | null
  has_no_website: boolean | null
  city: string | null
  state: string | null
  has_facility_license: boolean | null
  facility_license_type: string | null
  facility_license_number: string | null
  facility_license_agency: string | null
  lead_has_credential: boolean | null
  lead_credential_type: string | null
  lead_credential_number: string | null
  lead_credential_state: string | null
  /** Kinds of org_documents on file. */
  docKinds: string[]
  submitted: boolean
}

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0

/** Whether the screen's answer is already on file (independent of onboarding_progress). */
export function orgAnswerOnFile(id: string, d: OrgFlowData, door: OrgSignupPath): boolean {
  const facility = asksFacilityLicense(door)
  switch (id) {
    case 'org_type':
      return filled(d.org_type) && (d.org_type !== 'other' || filled(d.org_type_other))
    case 'org_name':
      return filled(d.facility_name)
    case 'org_website':
      return filled(d.website) || d.has_no_website === true
    case 'org_location':
      return filled(d.city) && /^[A-Z]{2}$/.test(d.state ?? '')
    case 'license':
      return facility ? d.has_facility_license != null : d.lead_has_credential != null
    case 'license_details':
      return facility
        ? d.has_facility_license !== true ||
            (filled(d.facility_license_type) && filled(d.facility_license_number) && filled(d.facility_license_agency))
        : d.lead_has_credential !== true ||
            (filled(d.lead_credential_type) && filled(d.lead_credential_number) && filled(d.lead_credential_state))
    case 'registration_doc':
      return d.docKinds.some((k) => k === 'business_registration' || k === 'facility_license')
    case 'submit':
      return d.submitted
    default:
      return false
  }
}

/** True when they said yes on screen 6, so the details follow-up is shown. */
export function holdsLicense(d: Pick<OrgFlowData, 'has_facility_license' | 'lead_has_credential'>, door: OrgSignupPath) {
  return asksFacilityLicense(door) ? d.has_facility_license === true : d.lead_has_credential === true
}

/** Resume inputs from a facility_profiles row (any shape) and its document kinds. */
export function orgFlowDataFromRow(org: Record<string, unknown>, docKinds: string[]): OrgFlowData {
  const s = (k: string) => (org[k] == null ? null : String(org[k]))
  const b = (k: string) => (org[k] == null ? null : org[k] === true)
  return {
    org_type: s('org_type'),
    org_type_other: s('org_type_other'),
    facility_name: s('facility_name'),
    website: s('website'),
    has_no_website: b('has_no_website'),
    city: s('city'),
    state: s('state'),
    has_facility_license: b('has_facility_license'),
    facility_license_type: s('facility_license_type'),
    facility_license_number: s('facility_license_number'),
    facility_license_agency: s('facility_license_agency'),
    lead_has_credential: b('lead_has_credential'),
    lead_credential_type: s('lead_credential_type'),
    lead_credential_number: s('lead_credential_number'),
    lead_credential_state: s('lead_credential_state'),
    docKinds,
    submitted: !!org.onboarding_submitted_at,
  }
}

/** Every question id in the organization flow, in order (for backfill and admin progress). */
export const ORG_FLOW_IDS = [
  'org_type',
  'org_name',
  'org_website',
  'org_location',
  'license',
  'license_details',
  'registration_doc',
  'submit',
] as const
