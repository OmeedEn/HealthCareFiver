/**
 * Client-safe types, labels and pure helpers for the admin verification
 * console (queue + applicant detail). No server-only imports.
 */

export const VERIFICATION_STATUSES = [
  'pending_review',
  'more_info_requested',
  'insurance_pending',
  'suspended',
  'approved',
  'rejected',
] as const

export type VerificationStatus =
  | (typeof VERIFICATION_STATUSES)[number]
  | 'not_submitted'

export const STATUS_LABEL: Record<string, string> = {
  not_submitted: 'Not submitted',
  pending_review: 'Pending review',
  more_info_requested: 'Needs info',
  insurance_pending: 'Insurance pending',
  suspended: 'Suspended',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const STATUS_BADGE: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  not_submitted: 'outline',
  pending_review: 'secondary',
  more_info_requested: 'outline',
  insurance_pending: 'secondary',
  suspended: 'destructive',
  approved: 'default',
  rejected: 'destructive',
}

/** Live = can be on the platform; these are re-screened monthly. */
export const LIVE_STATUSES = ['approved', 'insurance_pending']

export type Branch = 'clinical' | 'allied' | 'consultant' | 'educator'

/**
 * Which step-3 question set applies. Mirrors effectiveBranch() in
 * src/lib/onboarding/professional-branch.ts (Wizard agent) — kept local so
 * the admin console has no build-time dependency on the wizard.
 */
export function branchFor(
  category: string | null,
  credentialBasis: string | null
): Branch | null {
  if (category === 'other') {
    if (credentialBasis === 'license') return 'clinical'
    if (credentialBasis === 'certification') return 'allied'
    if (credentialBasis === 'none') return 'consultant'
    return null
  }
  if (
    category === 'clinical' ||
    category === 'allied' ||
    category === 'consultant' ||
    category === 'educator'
  ) {
    return category
  }
  return null
}

export const CATEGORY_LABEL: Record<string, string> = {
  clinical: 'Licensed clinical',
  allied: 'Allied / certified',
  consultant: 'Consultant',
  educator: 'Educator',
  other: 'Other',
}

/* ───────────── Self-disclosures ───────────── */

export const SELF_DISCLOSURE_QUESTIONS: { key: string; label: string }[] = [
  {
    key: 'license_action',
    label:
      'License ever suspended, revoked, restricted, surrendered, or under investigation?',
  },
  { key: 'exclusion', label: 'Excluded from Medicare or Medicaid?' },
  { key: 'conviction', label: 'Felony or healthcare-related conviction?' },
  { key: 'malpractice', label: 'Malpractice judgments or settlements?' },
]

export type SelfDisclosures = Record<
  string,
  { answer?: boolean | null; details?: string | null } | undefined
>

export function disclosureYesKeys(d: SelfDisclosures | null | undefined): string[] {
  if (!d || typeof d !== 'object') return []
  return SELF_DISCLOSURE_QUESTIONS.filter((q) => d[q.key]?.answer === true).map(
    (q) => q.key
  )
}

/* ───────────── Manual checklist ───────────── */

export interface ChecklistEntry {
  done: boolean
  by?: string | null
  at?: string | null
  note?: string | null
}

export type AdminChecklist = Record<string, ChecklistEntry | undefined>

export interface LookupLink {
  label: string
  href: string
}

export interface ChecklistItemDef {
  key: string
  label: string
  help?: string
  links?: LookupLink[]
  /** A lookup whose screenshot/PDF must be kept as evidence. */
  needsEvidence?: boolean
}

export const OIG_URL = 'https://exclusions.oig.hhs.gov/'
export const SAM_URL = 'https://sam.gov/search/?index=ex'
export const MEDI_CAL_URL =
  'https://files.medi-cal.ca.gov/pubsdoco/SandILanding.aspx'

export function nppesUrl(npi: string | null | undefined): string {
  const n = (npi ?? '').replace(/\D/g, '')
  return n
    ? `https://npiregistry.cms.hhs.gov/provider-view/${n}`
    : 'https://npiregistry.cms.hhs.gov/'
}

export const ALLIED_LOOKUPS: LookupLink[] = [
  { label: 'IBLCE (IBCLC)', href: 'https://iblce.org/verify-an-ibclc/' },
  { label: 'NBHWC (health & wellness coach)', href: 'https://nbhwc.org/find-a-nbc-hwc/' },
  // NASM has no stable public lookup URL; start from the site / contact NASM.
  { label: 'NASM', href: 'https://www.nasm.org/' },
  {
    label: 'ACE',
    href: 'https://www.acefitness.org/resources/everyone/find-ace-pro/',
  },
  {
    label: 'State acupuncture board (CA: DCA license search)',
    href: 'https://search.dca.ca.gov/',
  },
]

/** Special admin_checklist keys that are not checklist rows. */
export const PRESSURE_TO_RUSH_KEY = 'red_flag_pressure_to_rush'
export const NAME_ON_ID_KEY = 'recorded_name_government_id'
export const NAME_ON_MALPRACTICE_KEY = 'recorded_name_malpractice'

export const SPECIAL_CHECKLIST_KEYS = [
  PRESSURE_TO_RUSH_KEY,
  NAME_ON_ID_KEY,
  NAME_ON_MALPRACTICE_KEY,
]

export interface ChecklistContext {
  branch: Branch | null
  isOther: boolean
  npi: string | null
  needsMalpractice: boolean
  carriesInsurance: boolean
}

/** The manual checklist for one applicant, in review order. */
export function checklistFor(ctx: ChecklistContext): ChecklistItemDef[] {
  const items: ChecklistItemDef[] = []
  const credentialed = ctx.branch === 'clinical' || ctx.branch === 'allied'

  if (ctx.isOther) {
    items.push({
      key: 'other_fit',
      label: 'Fit decision: this profession belongs on Sanus',
      help:
        'Read the typed profession. Decide whether we list it. Verify via the licensing board / certifying body if they hold one; otherwise LinkedIn + video call. Record how you verified in the note.',
    })
  }

  items.push({
    key: 'name_match',
    label:
      ctx.branch === 'clinical'
        ? 'Name matches across government ID, license, and malpractice certificate'
        : ctx.branch === 'allied'
          ? 'Name matches across government ID, certification, and malpractice certificate'
          : 'Name on government ID matches the account name',
    help: 'Record the exact names below so mismatches show in Red flags.',
  })

  if (ctx.branch === 'clinical') {
    items.push({
      key: 'license_active',
      label: 'License active and clear — discipline section read',
      help:
        'Look the license up on each licensing state board. Confirm status is active, dates match, and read the discipline/actions section.',
      needsEvidence: true,
    })
    items.push({
      key: 'npi_match',
      label: 'NPI matches name and specialty',
      help: ctx.npi
        ? 'Open NPPES and compare name, taxonomy (specialty), and license state.'
        : 'No NPI given (optional). Mark done with a note if not applicable.',
      links: [{ label: 'NPPES NPI Registry', href: nppesUrl(ctx.npi) }],
      needsEvidence: !!ctx.npi,
    })
  }

  if (ctx.branch === 'allied') {
    items.push({
      key: 'cert_lookup',
      label: 'Certification found on the certifying body’s site',
      help:
        'There is no certification number field — search by name. Review the certification photo carefully (edits, mismatched fonts, dates, cropping).',
      links: ALLIED_LOOKUPS,
      needsEvidence: true,
    })
  }

  items.push(
    {
      key: 'oig_leie',
      label: 'OIG exclusion list (LEIE) — not excluded',
      links: [{ label: 'OIG LEIE search', href: OIG_URL }],
      needsEvidence: true,
    },
    {
      key: 'sam_gov',
      label: 'SAM.gov exclusions — not excluded',
      links: [{ label: 'SAM.gov exclusions', href: SAM_URL }],
      needsEvidence: true,
    },
    {
      key: 'medi_cal',
      label: 'Medi-Cal Suspended & Ineligible list — not listed',
      links: [{ label: 'Medi-Cal S&I list', href: MEDI_CAL_URL }],
      needsEvidence: true,
    }
  )

  if (credentialed) {
    items.push({
      key: 'self_disclosure_match',
      label: 'Self-disclosure answers match the lookups',
      help:
        'Rule: a "no" answer contradicted by a lookup (board action, exclusion, conviction, judgment) is a rejection.',
    })
  }

  if (ctx.needsMalpractice || ctx.carriesInsurance) {
    items.push({
      key: 'malpractice',
      label:
        'Malpractice current and covers the services offered — or Insurance pending with deadline logged',
      help:
        'Check carrier, policy number, coverage amount and expiry on the certificate. If not uploaded yet, approval puts them in Insurance pending (30-day deadline).',
    })
  }

  items.push({
    key: 'video_call',
    label: '5-minute video call (first cohort)',
    help:
      ctx.branch === 'consultant' || ctx.isOther
        ? 'Confirm identity against the ID and walk through their background / LinkedIn.'
        : 'Confirm identity against the ID and ask about their practice.',
  })

  return items
}

/* ───────────── Names ───────────── */

function nameTokens(name: string | null | undefined): string[] {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/[\s'-]+/)
    .filter(Boolean)
}

/**
 * Loose match: first and last name tokens equal (middle names / initials
 * ignored). Either side empty ⇒ null (nothing to compare).
 */
export function namesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean | null {
  const ta = nameTokens(a)
  const tb = nameTokens(b)
  if (ta.length === 0 || tb.length === 0) return null
  return ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1]
}

/** True if `name` matches `legal` or any of the comma/semicolon-separated `otherNames`. */
export function matchesAnyName(
  name: string | null | undefined,
  legal: string | null | undefined,
  otherNames: string | null | undefined
): boolean | null {
  const candidates = [legal, ...(otherNames ?? '').split(/[,;\n]/)]
    .map((s) => s?.trim())
    .filter(Boolean)
  if (!name?.trim() || candidates.length === 0) return null
  return candidates.some((c) => namesMatch(name, c) === true)
}

/* ───────────── Dates ───────────── */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** "Jan 1, 2026" for a DATE (YYYY-MM-DD) without a timezone shift. */
export function formatDay(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export function isPastDate(date: string | null | undefined): boolean {
  return !!date && date.slice(0, 10) < todayIso()
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const ms = new Date(date).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

export function isRescreenDue(
  status: string,
  lastCheck: string | null | undefined,
  rescreenDays: number
): boolean {
  if (!LIVE_STATUSES.includes(status)) return false
  if (!lastCheck) return true
  return Date.now() - new Date(lastCheck).getTime() > rescreenDays * 86_400_000
}

/* ───────────── Applicant detail payload ───────────── */

export interface ApplicantProfile {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  contractor_type: string | null
  professional_category: string | null
  other_profession: string | null
  credential_basis: string | null
  legal_name: string | null
  other_names: string | null
  license_type: string | null
  specialties: string[] | null
  state_license_number: string | null
  license_states: string[] | null
  license_issue_date: string | null
  license_expiration_date: string | null
  has_compact_license: boolean | null
  telehealth_states: string[] | null
  npi_number: string | null
  years_of_experience: number | null
  certification_type: string | null
  certifying_organization: string | null
  consulting_background: string | null
  client_types: string[] | null
  website_url: string | null
  primary_background: string | null
  teaching_topics: string | null
  ceu_accreditation: string | null
  offers_high_risk_services: boolean | null
  self_disclosures: SelfDisclosures | null
  carries_liability_insurance: boolean | null
  attested_accurate_at: string | null
  authorized_checks_at: string | null
  verification_status: string
  verification_notes: string | null
  verification_reviewed_at: string | null
  approved_at: string | null
  insurance_due_at: string | null
  insured_verified_at: string | null
  compliance_hold_reason: string | null
  last_exclusion_check_at: string | null
  admin_checklist: AdminChecklist | null
  contractor_agreement_accepted_at: string | null
  city: string | null
  state: string | null
  created_at: string | null
  onboarding_completed_at: string | null
}

export interface ApplicantCredential {
  id: string
  credential_type: string
  name: string
  issuing_authority: string | null
  license_number: string | null
  issued_date: string | null
  expiration_date: string | null
  coverage_amount: string | null
  status: string
  has_document: boolean
  document_filename: string | null
  verified_at: string | null
  created_at: string
}

export interface EvidenceItem {
  id: string
  check_key: string
  note: string | null
  created_by: string | null
  created_at: string
  filename: string
}

export interface ApplicantDuplicate {
  kind: string
  other_contractor: string
  other_name: string | null
}

export interface ApplicantCheck {
  id: string
  check_type: 'medallion' | 'checkr' | 'stripe_identity'
  status: string
  result_summary: Record<string, unknown> | null
  checked_at: string | null
}

export interface ApplicantOffering {
  id: string
  title: string
  status: string
  format: string | null
  requires_malpractice: boolean | null
}

export interface ApplicantData {
  profile: ApplicantProfile
  credentials: ApplicantCredential[]
  evidence: EvidenceItem[]
  /** null = duplicate lookup unavailable */
  duplicates: ApplicantDuplicate[] | null
  checks: ApplicantCheck[]
  offerings: ApplicantOffering[]
  /** admin id → display (email) for checklist "by" fields */
  adminNames: Record<string, string>
}

/** Filename part of an evidence storage path (`{uuid}-{name}` → name). */
export function evidenceFilename(storagePath: string): string {
  const last = storagePath.split('/').pop() ?? storagePath
  return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '')
}
