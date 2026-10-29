// Organization "Finish your profile" items (Single-Question Onboarding spec,
// "Dashboard items by path" → Organization). Built from facility_profiles,
// the org's documents and onboarding_progress. Pure — used by the dashboard,
// the admin queue ("Missing") and the approval guard in
// src/app/admin/organizations/actions.ts.

import { missingForApproval, type ChecklistItem } from '@/lib/onboarding/checklist'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'

/** Items that open a single-question screen at /dashboard/finish/organization/[item]. */
export const ORG_FINISH_ITEMS = [
  'registration_doc',
  'disclosures',
  'description',
  'org_size',
  'locations',
  'org_phone',
  'legal_name',
  'business_structure',
  'registration_state',
  'org_npi',
  'contact_title',
  'lead_linkedin',
  'license_expires',
  'additional_docs',
] as const
export type OrgFinishItem = (typeof ORG_FINISH_ITEMS)[number]

export function isOrgFinishItem(v: unknown): v is OrgFinishItem {
  return typeof v === 'string' && (ORG_FINISH_ITEMS as readonly string[]).includes(v)
}

export const finishHref = (item: OrgFinishItem) => `/dashboard/finish/organization/${item}`

/** The facility_profiles columns the checklist reads. */
export const ORG_CHECKLIST_COLUMNS =
  'has_facility_license, lead_has_credential, self_disclosures, description, org_size, zip_code, location_count, phone, legal_name, business_structure, registration_state, org_npi, contact_title, lead_linkedin, facility_license_expires, org_agreement_accepted_at, verification_status'

export interface OrgChecklistRow {
  has_facility_license?: boolean | null
  lead_has_credential?: boolean | null
  self_disclosures?: unknown
  description?: string | null
  org_size?: string | null
  zip_code?: string | null
  location_count?: number | null
  phone?: string | null
  legal_name?: string | null
  business_structure?: string | null
  registration_state?: string | null
  org_npi?: string | null
  contact_title?: string | null
  lead_linkedin?: string | null
  facility_license_expires?: string | null
  org_agreement_accepted_at?: string | null
  verification_status?: string | null
}

export interface OrgChecklistInput {
  door: OrgSignupPath
  org: OrgChecklistRow
  /** Kinds of org_documents on file. */
  docKinds: string[]
  /** onboarding_progress (flow 'organization'). */
  answered: string[]
  skipped: string[]
  hasLogo: boolean
  payoutsOnboarded: boolean
  /**
   * Hiring org that hasn't submitted verification yet (verify later,
   * src/lib/onboarding/org-verify-later.ts): one "Verify your organization"
   * item replaces the approval items until they submit.
   */
  verifyLater?: boolean
  /** Signed up through the Hiring door (profiles.signup_path = 'HIRING'): no seller items. */
  buyer?: boolean
}

const filled = (v: unknown) => (typeof v === 'string' ? v.trim().length > 0 : v != null)

export function hasRegistrationDoc(docKinds: string[]): boolean {
  return docKinds.some((k) => k === 'business_registration' || k === 'facility_license')
}

/** The disclosure keys this org is asked: the license one only if it holds a facility license. */
export function disclosureKeysFor(org: Pick<OrgChecklistRow, 'has_facility_license'>) {
  return org.has_facility_license === true
    ? (['license_action', 'exclusion', 'workforce_action'] as const)
    : (['exclusion', 'workforce_action'] as const)
}

export function disclosuresAnswered(org: Pick<OrgChecklistRow, 'has_facility_license' | 'self_disclosures'>): boolean {
  const sd = (org.self_disclosures ?? {}) as Record<string, { answer?: unknown } | undefined>
  return disclosureKeysFor(org).every((k) => typeof sd[k]?.answer === 'boolean')
}

export function buildOrgChecklist(input: OrgChecklistInput): ChecklistItem[] {
  const { org, door, docKinds, answered, skipped } = input
  const approved = org.verification_status === 'approved'
  const regDoc = hasRegistrationDoc(docKinds)
  const done = (id: string, v: boolean) => v || answered.includes(id)
  const items: ChecklistItem[] = []

  // Needed for approval
  if (input.verifyLater) {
    items.push({
      id: 'verify',
      group: 'needed_for_approval',
      label: 'Verify your organization',
      hint: 'Needed before you post a staffing need, book, or contact professionals.',
      done: false,
      href: '/onboarding/organization',
    })
  } else if (!regDoc || skipped.includes('registration_doc')) {
    items.push({
      id: 'registration_doc',
      group: 'needed_for_approval',
      label: 'Upload your registration or facility license',
      hint: 'A facility license, business license, or Secretary of State registration.',
      done: regDoc,
      href: finishHref('registration_doc'),
    })
  }
  if (!input.verifyLater) items.push({
    id: 'disclosures',
    group: 'needed_for_approval',
    label: 'Answer the disclosure question',
    hint: 'Do any of these apply to your organization?',
    done: disclosuresAnswered(org),
    href: finishHref('disclosures'),
  })

  // Needed after approval
  items.push({
    id: 'org_agreement',
    group: 'needed_after_approval',
    label: 'Accept the organization agreement',
    hint: approved ? 'Before your first listing or post goes live.' : 'Unlocks once you’re approved.',
    done: !!org.org_agreement_accepted_at,
    href: '/dashboard#org-agreement',
    locked: !approved,
  })
  // Buyers (Hiring door) don't get paid; payouts are for sellers.
  if (!input.buyer) items.push({
    id: 'payouts',
    group: 'needed_after_approval',
    label: 'Set up payouts',
    hint: 'Needed before your first paid event or service.',
    done: input.payoutsOnboarded,
    href: '/facility/payments',
    locked: !approved,
  })

  // Make your profile stand out
  const standOut = (id: string, label: string, isDone: boolean, href: string = finishHref(id as OrgFinishItem)) =>
    items.push({ id, group: 'stand_out', label, done: done(id, isDone), href })
  standOut('logo', 'Add your logo', input.hasLogo, '/settings')
  standOut('description', 'Describe your organization', filled(org.description))
  standOut('org_size', 'Organization size', filled(org.org_size))
  standOut('locations', 'ZIP and additional locations', filled(org.zip_code) && filled(org.location_count))
  standOut('org_phone', 'Organization phone', filled(org.phone))
  standOut('legal_name', 'Legal name, if different', filled(org.legal_name))
  standOut('business_structure', 'Business structure', filled(org.business_structure))
  standOut('registration_state', 'State of registration', filled(org.registration_state))
  standOut('org_npi', 'Organization NPI', filled(org.org_npi))
  standOut('contact_title', 'Your role or title', filled(org.contact_title))
  if (door === 'COMPANY') standOut('lead_linkedin', 'Lead person’s LinkedIn', filled(org.lead_linkedin))
  if (org.has_facility_license === true) {
    standOut('license_expires', 'Facility license expiration date', filled(org.facility_license_expires))
  }
  standOut('additional_docs', 'Additional documents', docKinds.includes('other'))

  return items
}

/** Needed-for-approval items still open: shown to staff as "Missing"; approval is refused while any remain. */
export function orgMissingForApproval(input: Pick<OrgChecklistInput, 'org' | 'docKinds'>): ChecklistItem[] {
  return missingForApproval(
    buildOrgChecklist({
      door: 'HIRING',
      answered: [],
      skipped: [],
      hasLogo: false,
      payoutsOnboarded: false,
      ...input,
    })
  )
}
