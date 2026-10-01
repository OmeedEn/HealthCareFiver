/**
 * Organization verification: statuses, labels, banner copy and the admin
 * manual review checklist (Organization Onboarding spec, "Manual review
 * checklist (internal)"). Client-safe — no server imports.
 *
 * Status lives in facility_profiles.verification_status and is enforced in
 * the database (see 20261001000500_org_verification.sql): until an org is
 * approved it can save drafts but can't publish, message professionals or
 * move applicants, and other users can't see it.
 */

export const ORG_STATUSES = [
  'pending_review',
  'needs_info',
  'approved',
  'suspended',
  'rejected',
] as const

export type OrgStatus = (typeof ORG_STATUSES)[number]

export const ORG_STATUS_LABEL: Record<OrgStatus, string> = {
  pending_review: 'Pending review',
  needs_info: 'Needs info',
  approved: 'Approved',
  suspended: 'Suspended',
  rejected: 'Rejected',
}

export const ORG_STATUS_BADGE: Record<
  OrgStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  pending_review: 'secondary',
  needs_info: 'outline',
  approved: 'default',
  suspended: 'destructive',
  rejected: 'destructive',
}

export function isOrgStatus(value: unknown): value is OrgStatus {
  return typeof value === 'string' && (ORG_STATUSES as readonly string[]).includes(value)
}

export type OrgDecision = 'approve' | 'needs_info' | 'suspend' | 'reject' | 'reopen'

/** Admin decisions available from each status. */
export const ORG_ALLOWED_DECISIONS: Record<OrgStatus, OrgDecision[]> = {
  pending_review: ['approve', 'needs_info', 'reject'],
  needs_info: ['approve', 'needs_info', 'reject'],
  approved: ['suspend'],
  suspended: ['approve', 'reject'],
  rejected: ['reopen', 'approve'],
}

export const ORG_DECISION_LABEL: Record<OrgDecision, string> = {
  approve: 'Approve',
  needs_info: 'Request more info',
  suspend: 'Suspend',
  reject: 'Reject',
  reopen: 'Reopen review',
}

/** Decisions that must include a note to the organization. */
export const ORG_DECISION_NEEDS_NOTE: OrgDecision[] = ['needs_info', 'suspend', 'reject']

/** One sentence for disabled buttons: why the action isn't available yet. */
export function orgBlockedReason(status: OrgStatus | null | undefined): string | null {
  switch (status) {
    case 'approved':
    case null:
    case undefined:
      return null
    case 'pending_review':
    case 'needs_info':
      return 'Available once your organization is approved. You can save drafts in the meantime.'
    case 'suspended':
      return 'Your organization is suspended, so this is turned off.'
    case 'rejected':
      return 'Your organization wasn’t approved, so this isn’t available.'
  }
}

export interface OrgBannerConfig {
  title: string
  body: string
  tone: 'info' | 'warning' | 'danger'
  /** Show the reviewer's notes under the title. */
  showNotes: boolean
}

export const ORG_BANNER: Record<Exclude<OrgStatus, 'approved'>, OrgBannerConfig> = {
  pending_review: {
    title: 'Your application is under review. We’ll email you within 24-48 hours.',
    body: 'In the meantime you can explore your dashboard, complete your organization profile, and save job posts as drafts. Publishing, messaging professionals, and reviewing applicants unlock once you’re approved.',
    tone: 'info',
    showNotes: false,
  },
  needs_info: {
    title: 'Action needed: our review team needs more information',
    body: 'Update your organization profile with the details below. We’ll pick your review back up as soon as you do.',
    tone: 'warning',
    showNotes: true,
  },
  suspended: {
    title: 'Your organization is suspended',
    body: 'Your posts are hidden and you can’t message professionals or review applicants. Reply to our email to resolve this.',
    tone: 'danger',
    showNotes: true,
  },
  rejected: {
    title: 'Your organization wasn’t approved',
    body: 'If you think this is a mistake, reply to our email and we’ll take another look.',
    tone: 'danger',
    showNotes: true,
  },
}

/* ───────────── Admin manual review checklist ───────────── */

export interface OrgChecklistEntry {
  done: boolean
  by?: string | null
  at?: string | null
  note?: string | null
}

export type OrgChecklist = Record<string, OrgChecklistEntry | undefined>

export interface OrgChecklistItem {
  key: string
  label: string
  help: string
  links?: { label: string; href: string }[]
  /** Keep a dated screenshot/PDF of the lookup. */
  needsEvidence: boolean
}

export const CA_BIZFILE_URL = 'https://bizfileonline.sos.ca.gov/search/business'
export const CDPH_LOOKUP_URL = 'https://www.cdph.ca.gov/Programs/CHCQ/LCP/Pages/HFCIS.aspx'
export const NPPES_URL = 'https://npiregistry.cms.hhs.gov/search'
export const OIG_URL = 'https://exclusions.oig.hhs.gov/'
export const SAM_URL = 'https://sam.gov/search/?index=ex'

export const ORG_CHECKLIST: OrgChecklistItem[] = [
  {
    key: 'business_exists',
    label: 'Business exists',
    help: 'Secretary of State lookup matches the legal name and state of registration.',
    links: [{ label: 'CA bizfile', href: CA_BIZFILE_URL }],
    needsEvidence: true,
  },
  {
    key: 'website_and_email',
    label: 'Website is real and matches; work email domain matches the website',
    help: 'Free email only (Gmail, Yahoo…) or no web presence is a red flag.',
    needsEvidence: false,
  },
  {
    key: 'facility_license',
    label: 'Facility license is active and matches name and address',
    help: 'Use the state agency lookup (CDPH covers hospitals, clinics, and home health). Skip if they don’t hold one.',
    links: [{ label: 'CDPH facility lookup', href: CDPH_LOOKUP_URL }],
    needsEvidence: true,
  },
  {
    key: 'org_npi',
    label: 'Organization NPI matches (if given)',
    help: 'NPPES type 2 (organization) record matches name and address.',
    links: [{ label: 'NPPES', href: NPPES_URL }],
    needsEvidence: true,
  },
  {
    key: 'exclusions',
    label: 'OIG and SAM.gov exclusion check on the organization name',
    help: 'No match on either list.',
    links: [
      { label: 'OIG LEIE', href: OIG_URL },
      { label: 'SAM.gov', href: SAM_URL },
    ],
    needsEvidence: true,
  },
  {
    key: 'self_disclosures',
    label: 'Self-disclosure answers match what you found',
    help: 'Any “yes” has a reasonable explanation; nothing found contradicts a “no”.',
    needsEvidence: false,
  },
  {
    key: 'authorized_rep',
    label: 'Authorized representative makes sense',
    help: 'Check LinkedIn, or do a quick call for the first cohort.',
    needsEvidence: false,
  },
  {
    key: 'evidence_saved',
    label: 'Screenshot or PDF of every lookup saved with the date',
    help: 'Attach evidence on the items above.',
    needsEvidence: false,
  },
  {
    key: 'listings_reviewed',
    label: 'Every listing, event, and staffing post reviewed before it goes live',
    help: 'Ongoing. Check drafts they’ve saved so far.',
    needsEvidence: false,
  },
]

export const ORG_RED_FLAGS = [
  'Free email only, or no web presence',
  'Name or license mismatch',
  'Pressure to rush approval',
  'Vague pay, or pay far below market',
  'Asks applicants to pay or buy something',
  'Asks for SSNs or personal info up front',
  'Same phone or payment details across multiple orgs',
]

export function checklistProgress(checklist: OrgChecklist | null | undefined): {
  done: number
  total: number
} {
  const total = ORG_CHECKLIST.length
  const done = ORG_CHECKLIST.filter((i) => checklist?.[i.key]?.done).length
  return { done, total }
}
