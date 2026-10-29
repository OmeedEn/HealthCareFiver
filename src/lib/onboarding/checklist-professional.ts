// Professional "Finish your profile" items (Single-Question Onboarding spec,
// "Dashboard items by path → Professional"). Computed from profile data and
// uploads; skipped onboarding screens show up because their data is
// missing. Pure — safe on server and client. The shared shape, group config
// and weighted percent live in ./checklist.

import type { ChecklistItem } from '@/lib/onboarding/checklist'
import type { ProfessionalBranch } from '@/lib/onboarding/professional-branch'
import { PRO_Q } from '@/lib/onboarding/questions/professional'

/** Single-question screens for checklist items: /dashboard/finish/professional/[item]. */
export const FINISH_BASE = '/dashboard/finish/professional'

/** Items with their own single-question screen there. */
export const PRO_FINISH_ITEMS = [
  'credential_upload',
  'government_id',
  'years',
  'specialty',
  'npi',
  'license_dates',
  'other_names',
  'states',
  'languages',
  'phone',
  'website',
] as const
export type ProFinishItem = (typeof PRO_FINISH_ITEMS)[number]

export function isProFinishItem(v: string): v is ProFinishItem {
  return (PRO_FINISH_ITEMS as readonly string[]).includes(v)
}

export interface CredentialLike {
  credential_type: string
  document_url: string | null
  status: string
}

const usable = (c: CredentialLike) => !!c.document_url && c.status !== 'rejected'

function hasType(creds: CredentialLike[], types: string[]): boolean {
  return creds.some((c) => usable(c) && types.includes(c.credential_type))
}

const UPLOAD_LABEL: Record<ProfessionalBranch, string> = {
  clinical: 'Upload your license',
  allied: 'Upload your certification',
  consultant: 'Upload your resume or CV',
  educator: 'Upload your resume or CV',
}

/**
 * Needed for approval: the license / certification / resume upload and the
 * government ID. In the beta these never block submitting — they block
 * approval (the admin approve route refuses while any are open) and show in
 * the admin queue as "Missing".
 */
export function professionalApprovalItems(
  branch: ProfessionalBranch | null,
  credentials: CredentialLike[]
): ChecklistItem[] {
  const credTypes = !branch
    ? ['license', 'certification', 'resume']
    : branch === 'consultant' || branch === 'educator'
      ? ['resume']
      : ['license', 'certification']
  return [
    {
      id: PRO_Q.credentialUpload,
      group: 'needed_for_approval',
      label: branch ? UPLOAD_LABEL[branch] : 'Upload your license, certification, or resume',
      hint: 'A photo or PDF. Private and encrypted.',
      done: hasType(credentials, credTypes),
      href: `${FINISH_BASE}/credential_upload`,
    },
    {
      id: PRO_Q.governmentId,
      group: 'needed_for_approval',
      label: 'Upload your government ID',
      hint: 'Only used to confirm you are you.',
      done: hasType(credentials, ['government_id']),
      href: `${FINISH_BASE}/government_id`,
    },
  ]
}

/** Labels of the open Needed-for-approval items (admin "Missing" badges, approve gate). */
export function professionalMissingForApproval(
  branch: ProfessionalBranch | null,
  credentials: CredentialLike[]
): string[] {
  const short: Record<string, string> = {
    [PRO_Q.credentialUpload]: !branch
      ? 'Credential upload'
      : branch === 'clinical'
        ? 'License upload'
        : branch === 'allied'
          ? 'Certification upload'
          : 'Resume or CV',
    [PRO_Q.governmentId]: 'Government ID',
  }
  return professionalApprovalItems(branch, credentials)
    .filter((i) => !i.done)
    .map((i) => short[i.id] ?? i.label)
}

export interface ProfessionalChecklistInput {
  branch: ProfessionalBranch | null
  verificationStatus: string | null
  profile: {
    bio?: string | null
    years_of_experience?: number | null
    specialties?: string[] | null
    npi_number?: string | null
    license_issue_date?: string | null
    license_expiration_date?: string | null
    other_names?: string | null
    telehealth_states?: string[] | null
    languages?: string[] | null
    website_url?: string | null
    offers_high_risk_services?: boolean | null
    insured_verified_at?: string | null
    contractor_agreement_accepted_at?: string | null
  }
  /** profiles.phone */
  phone: string | null
  /** profiles.avatar_url (headshot) */
  avatarUrl: string | null
  stripeConnectOnboarded: boolean
  credentials: CredentialLike[]
  /** professional_offerings by status; omit when unknown. */
  listings?: { total: number; published: number; inReview: number }
  /** Non-blocked contractor_availability rows; omit when unknown. */
  availabilitySlots?: number
  /** onboarding_progress for the professional flow. */
  answered: string[]
}

const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const list = (v: unknown) => Array.isArray(v) && v.some(text)

/** Everything after approval (agreement, payouts, first listing), one screen at a time. */
const GO_LIVE = '/go-live'

export function buildProfessionalChecklist(input: ProfessionalChecklistInput): ChecklistItem[] {
  const { branch, profile: p, credentials } = input
  const status = input.verificationStatus ?? 'not_submitted'
  const approved = status === 'approved' || status === 'insurance_pending'
  const lockedHint = 'Available once your application is approved.'
  const items: ChecklistItem[] = [...professionalApprovalItems(branch, credentials)]

  /* ── Needed after approval ── */
  items.push({
    id: 'agreement',
    group: 'needed_after_approval',
    label: 'Accept the provider agreement',
    hint: approved ? 'Required before your first listing publishes.' : lockedHint,
    done: !!p.contractor_agreement_accepted_at,
    href: GO_LIVE,
    locked: !approved,
  })
  if (input.listings) {
    const { total, published, inReview } = input.listings
    items.push({
      id: 'first_listing',
      group: 'needed_after_approval',
      label: 'Add a service, consulting offer, or event',
      hint:
        total > 0 && published + inReview === 0
          ? 'You have a draft. Submit it for review once you’re approved.'
          : 'Save it as a draft anytime. It publishes once you’re approved.',
      done: published + inReview > 0,
      // Approved: the go-live flow's first-listing screens.
      href: total > 0 ? '/contractor/listings' : approved ? `${GO_LIVE}?step=listing` : '/contractor/listings/new',
    })
  }
  if (p.offers_high_risk_services) {
    items.push({
      id: 'malpractice',
      group: 'needed_after_approval',
      label: 'Upload your malpractice insurance',
      hint: 'Needed for in-person or hands-on care, home visits, prescribing, injectables, or IVs.',
      done: !!p.insured_verified_at || hasType(credentials, ['malpractice_insurance']),
      href: '/contractor/credentials/upload?type=malpractice_insurance',
    })
  }
  items.push({
    id: 'payouts',
    group: 'needed_after_approval',
    label: 'Set up payouts',
    hint: approved ? 'Before your first paid booking.' : lockedHint,
    done: input.stripeConnectOnboarded,
    href: `${GO_LIVE}?step=payouts`,
    locked: !approved,
  })

  /* ── Make your profile stand out ── */
  const standOut = (id: string, label: string, done: boolean, href: string, hint?: string) =>
    items.push({ id, group: 'stand_out', label, done, href, ...(hint ? { hint } : {}) })

  standOut('headshot', 'Add a headshot', text(input.avatarUrl), '/contractor/profile/edit')
  standOut('bio', 'Write a short bio', text(p.bio), '/contractor/profile/edit')
  standOut('years', 'Years of experience', typeof p.years_of_experience === 'number', `${FINISH_BASE}/years`)
  standOut('specialty', 'Specialty details', list(p.specialties), `${FINISH_BASE}/specialty`)
  if (branch === 'clinical') {
    standOut('npi', 'NPI number', text(p.npi_number), `${FINISH_BASE}/npi`)
    standOut(
      'license_dates',
      'License issue and expiration dates',
      text(p.license_issue_date) && text(p.license_expiration_date),
      `${FINISH_BASE}/license_dates`
    )
  }
  // other_names: '' = "I haven't used other names" (answered); null = not asked yet.
  standOut('other_names', 'Other names used', typeof p.other_names === 'string', `${FINISH_BASE}/other_names`)
  standOut(
    'states',
    branch === 'clinical' ? 'States where clients are located and compact license' : 'States where clients are located',
    list(p.telehealth_states),
    `${FINISH_BASE}/states`
  )
  standOut('languages', 'Languages', list(p.languages), `${FINISH_BASE}/languages`)
  standOut('phone', 'Phone number', text(input.phone), `${FINISH_BASE}/phone`)
  if (input.listings) {
    standOut(
      'pricing',
      'Pricing, format, and duration for each service',
      input.listings.total > 0,
      input.listings.total > 0 ? '/contractor/listings' : '/contractor/listings/new'
    )
  }
  if (input.availabilitySlots !== undefined) {
    standOut('availability', 'Availability', input.availabilitySlots > 0, '/contractor/availability')
  }
  // Only when skipped or never asked: "I don't have one" answered it.
  if (text(p.website_url) || !input.answered.includes(PRO_Q.website)) {
    standOut('website', 'Website or LinkedIn', text(p.website_url), `${FINISH_BASE}/website`)
  }
  const certCount = credentials.filter(
    (c) => usable(c) && ['license', 'certification', 'degree', 'cpr_bls', 'acls', 'pals', 'other'].includes(c.credential_type)
  ).length
  standOut(
    'additional_certs',
    'Additional certifications',
    certCount >= (branch === 'clinical' || branch === 'allied' ? 2 : 1),
    '/contractor/credentials/upload'
  )

  return items
}
