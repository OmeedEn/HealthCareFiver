/**
 * Marketplace eligibility: the single rule set for "can this provider /
 * organization publish this listing" and "can this listing be shown or
 * booked". Pure (no I/O, no imports) so it runs in server code, in the
 * dependency-free check script (scripts/check-eligibility.mjs, executed by
 * Node's built-in type stripping), and mirrors the SQL in
 * supabase/migrations/20261114100100_eligibility_enforcement.sql.
 *
 * Keep this file erasable-TypeScript only (no enums, namespaces, parameter
 * properties) and import-free, or the check script stops running.
 *
 * Outcomes:
 *   eligible       the action may proceed
 *   manual_review  no maintained ruleset covers it; Sanus must review before
 *                  it proceeds (treated as "not allowed" by every gate)
 *   ineligible     refused; `reasons` says why
 *
 * Deliberate non-rules (see docs/state-model.md, "Decisions needed"):
 *   - no malpractice grace period: a high-risk listing without reviewed
 *     coverage is never published or booked;
 *   - no clinical scope/location ruleset: clinical service bookings go to
 *     manual review, and out-of-licensed-state requests are refused;
 *   - availability ("Available", "Accepting clients", weekly hours) is not an
 *     input. It can never make an ineligible listing eligible.
 */

export type EligibilityOutcome = 'eligible' | 'manual_review' | 'ineligible'

export type EligibilityReason =
  // provider / account
  | 'not_a_provider'
  | 'account_inactive'
  | 'application_incomplete'
  | 'application_pending'
  | 'application_rejected'
  | 'suspended'
  | 'compliance_hold'
  | 'agreement_required'
  | 'credential_expired'
  // organization
  | 'org_not_approved'
  | 'org_agreement_required'
  // listing
  | 'listing_not_published'
  | 'listing_not_submitted'
  | 'listing_incomplete'
  | 'event_past'
  | 'malpractice_coverage_required'
  | 'org_coverage_unsupported'
  // clinical location / scope
  | 'clinical_ruleset_missing'
  | 'client_location_unknown'
  | 'outside_licensed_states'

/** publish = an admin moves a listing to 'published'; submit = owner sends it to review. */
export type EligibilityAction = 'submit' | 'publish' | 'view' | 'book'

export type EligibilityResult = {
  outcome: EligibilityOutcome
  reasons: EligibilityReason[]
  /** The listing needs reviewed malpractice coverage (high-risk). */
  highRisk: boolean
}

export type CredentialFact = {
  credential_type: string
  status: string
  /** YYYY-MM-DD or null (no expiry). */
  expiration_date: string | null
}

export type ProviderFacts = {
  role: string | null
  isActive: boolean | null
  verificationStatus: string | null
  agreementAcceptedAt: string | null
  complianceHoldReason: string | null
  /** clinical | allied | consultant | educator | other | null */
  professionalCategory: string | null
  /** Self-reported (contractor_profiles.license_expiration_date). */
  licenseExpirationDate: string | null
  /** contractor_profiles.license_state + license_states (two-letter codes). */
  licenseStates: string[]
  telehealthStates: string[]
  /** insured_verified_at IS NOT NULL (admin reviewed a coverage document). */
  insuranceReviewed: boolean
  credentials: CredentialFact[]
}

export type OfferingFacts = {
  kind: 'service' | 'consulting' | 'event'
  status: string
  format: string | null
  /** Prescribing, injectables or IVs (professional_offerings column). */
  involvesMedicalProcedures: boolean | null
  /** New nullable risk flag: hands-on care. null = not declared. */
  handsOnCare: boolean | null
  /** Listing has the fields required to be shown (title, price, ...). */
  complete?: boolean
}

export type OrgFacts = {
  verificationStatus: string | null
  agreementAcceptedAt: string | null
}

export type OrgListingFacts = {
  kind: 'service' | 'event'
  status: string
  format: string | null
  startsAt: string | null
  /** New nullable risk flags; null = not declared. */
  handsOnCare: boolean | null
  involvesMedicalProcedures: boolean | null
}

export type BookingContext = {
  /** Two-letter state of the client / service location, if known. */
  clientState?: string | null
}

/* ───────────── helpers ───────────── */

const LIVE_STATUSES = ['approved', 'insurance_pending']
const VALID_CREDENTIAL_STATUSES = ['verified', 'expiring_soon']
const ONCE_VERIFIED_STATUSES = ['verified', 'expiring_soon', 'expired']
/** Credential types whose lapse makes a provider ineligible (malpractice is per-listing). */
const LAPSE_TYPES = ['license', 'certification', 'government_id']
/** Categories whose services are not clinical care. */
const NONCLINICAL_CATEGORIES = ['consultant', 'educator']

/** YYYY-MM-DD for `now` in UTC (the SQL side compares to CURRENT_DATE). */
function today(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function isPast(date: string, now: Date): boolean {
  return date.slice(0, 10) < today(now)
}

function hasCurrent(creds: CredentialFact[], type: string, now: Date): boolean {
  return creds.some(
    (c) =>
      c.credential_type === type &&
      VALID_CREDENTIAL_STATUSES.includes(c.status) &&
      (c.expiration_date === null || !isPast(c.expiration_date, now))
  )
}

function result(reasons: EligibilityReason[], review: EligibilityReason[], highRisk: boolean): EligibilityResult {
  if (reasons.length) return { outcome: 'ineligible', reasons: [...reasons, ...review], highRisk }
  if (review.length) return { outcome: 'manual_review', reasons: review, highRisk }
  return { outcome: 'eligible', reasons: [], highRisk }
}

/* ───────────── providers ───────────── */

/**
 * A license / certification / government ID lapse that hasn't been cured by a
 * current verified credential of the same type. The daily compliance cron
 * turns these into a compliance hold; this closes the gap until it runs.
 */
export function hasExpiredCredential(p: ProviderFacts, now: Date): boolean {
  if (p.licenseExpirationDate && isPast(p.licenseExpirationDate, now)) {
    const renewed = p.credentials.some(
      (c) =>
        c.credential_type === 'license' &&
        VALID_CREDENTIAL_STATUSES.includes(c.status) &&
        c.expiration_date !== null &&
        !isPast(c.expiration_date, now) &&
        c.expiration_date > p.licenseExpirationDate!
    )
    if (!renewed) return true
  }
  for (const type of LAPSE_TYPES) {
    if (hasCurrent(p.credentials, type, now)) continue
    const lapsed = p.credentials.some(
      (c) =>
        c.credential_type === type &&
        ONCE_VERIFIED_STATUSES.includes(c.status) &&
        c.expiration_date !== null &&
        isPast(c.expiration_date, now)
    )
    if (lapsed) return true
  }
  return false
}

/** Reviewed coverage document on file AND a current verified certificate (SQL is_insured). */
export function hasReviewedCoverage(p: ProviderFacts, now: Date): boolean {
  return p.insuranceReviewed && hasCurrent(p.credentials, 'malpractice_insurance', now)
}

/** Provider-level gates (who), independent of any listing. */
export function providerReasons(p: ProviderFacts, now: Date): EligibilityReason[] {
  if (p.role !== 'contractor') return ['not_a_provider']
  const reasons: EligibilityReason[] = []
  if (p.isActive === false) reasons.push('account_inactive')
  switch (p.verificationStatus) {
    case 'approved':
    case 'insurance_pending':
      break
    case 'rejected':
      reasons.push('application_rejected')
      break
    case 'suspended':
      reasons.push('suspended')
      break
    case 'pending_review':
    case 'more_info_requested':
      reasons.push('application_pending')
      break
    default: // not_submitted, null, unknown
      reasons.push('application_incomplete')
  }
  if (p.complianceHoldReason) reasons.push('compliance_hold')
  if (LIVE_STATUSES.includes(p.verificationStatus ?? '') && !p.agreementAcceptedAt) {
    reasons.push('agreement_required')
  }
  if (hasExpiredCredential(p, now)) reasons.push('credential_expired')
  return reasons
}

export function isProviderEligible(p: ProviderFacts, now: Date): boolean {
  return providerReasons(p, now).length === 0
}

/**
 * High-risk = needs malpractice coverage: hands-on / in-person care, home
 * visits, prescribing, injectables, IVs. Consulting and events are not care.
 * An in-person service with hands-on care undeclared counts as high-risk
 * (fail closed) unless the provider's category is clearly nonclinical
 * (consultant / educator) — an in-person meeting is not in-person care.
 */
export function offeringIsHighRisk(o: OfferingFacts, providerCategory: string | null): boolean {
  if (o.involvesMedicalProcedures === true) return true
  if (o.handsOnCare === true) return true
  if (o.kind !== 'service') return false
  if (o.format === 'home_visit') return true
  if (o.format === 'in_person') {
    if (o.handsOnCare === false) return false
    return !NONCLINICAL_CATEGORIES.includes(providerCategory ?? '')
  }
  return false
}

/** Clinical care: a service by a clinical professional. Consulting / events are not. */
export function offeringIsClinical(o: OfferingFacts, providerCategory: string | null): boolean {
  return o.kind === 'service' && providerCategory === 'clinical'
}

/**
 * The one eligibility check for professional_offerings.
 *   submit  owner sends a draft to review: provider gates + listing complete
 *   publish admin publishes: provider gates + listing was submitted
 *           (pending_review / paused — approval never publishes a draft)
 *           + coverage. Admin review is the manual review for clinical scope.
 *   view    public visibility: published + provider gates + coverage
 *   book    view + clinical location rules (manual review / licensed states)
 */
export function evaluateOffering(
  action: EligibilityAction,
  provider: ProviderFacts,
  offering: OfferingFacts,
  now: Date,
  ctx: BookingContext = {}
): EligibilityResult {
  const reasons = providerReasons(provider, now)
  const review: EligibilityReason[] = []
  const highRisk = offeringIsHighRisk(offering, provider.professionalCategory)

  if (action === 'submit') {
    if (offering.complete === false) reasons.push('listing_incomplete')
    // Coverage is checked at publish; submitting for review is allowed.
    return result(reasons, review, highRisk)
  }

  if (action === 'publish') {
    if (!['pending_review', 'paused', 'published'].includes(offering.status)) {
      reasons.push('listing_not_submitted')
    }
  } else if (offering.status !== 'published') {
    reasons.push('listing_not_published')
  }

  if (highRisk && !hasReviewedCoverage(provider, now)) {
    reasons.push('malpractice_coverage_required')
  }

  if (action === 'book' && offeringIsClinical(offering, provider.professionalCategory)) {
    const state = ctx.clientState?.trim().toUpperCase() || null
    if (!state) {
      review.push('client_location_unknown')
    } else {
      const allowed = new Set(
        [
          ...provider.licenseStates,
          ...(offering.format === 'virtual' ? provider.telehealthStates : []),
        ].map((s) => s.trim().toUpperCase())
      )
      if (!allowed.has(state)) reasons.push('outside_licensed_states')
    }
    // No maintained clinical scope/jurisdiction ruleset exists yet.
    review.push('clinical_ruleset_missing')
  }

  return result(reasons, review, highRisk)
}

/* ───────────── organizations ───────────── */

export function orgReasons(org: OrgFacts | null): EligibilityReason[] {
  if (!org || org.verificationStatus !== 'approved') return ['org_not_approved']
  if (!org.agreementAcceptedAt) return ['org_agreement_required']
  return []
}

/**
 * Organization listings have no coverage model (organizations upload no
 * malpractice documents). High-risk org services therefore can't publish or
 * be booked until owners decide one. Home visits are always high-risk;
 * in-person / hybrid services are high-risk unless both risk flags are
 * explicitly false. Events are education, not care.
 */
export function orgListingIsHighRisk(l: OrgListingFacts): boolean {
  if (l.handsOnCare === true || l.involvesMedicalProcedures === true) return true
  if (l.kind !== 'service') return false
  if (l.format === 'home_visit') return true
  if (l.format === 'in_person' || l.format === 'hybrid') {
    return !(l.handsOnCare === false && l.involvesMedicalProcedures === false)
  }
  return false
}

/**
 * The one eligibility check for org_listings.
 *   submit  owner: org approved + agreement accepted
 *   publish admin: + listing in review (never straight from draft) + no
 *           unsupported high-risk service
 *   view    published + org eligible + no unsupported high-risk service
 *   book    view + event not in the past
 */
export function evaluateOrgListing(
  action: EligibilityAction,
  org: OrgFacts | null,
  listing: OrgListingFacts,
  now: Date
): EligibilityResult {
  const reasons = orgReasons(org)
  const highRisk = orgListingIsHighRisk(listing)
  if (action === 'submit') return result(reasons, [], highRisk)

  if (action === 'publish') {
    if (!['in_review', 'published'].includes(listing.status)) reasons.push('listing_not_submitted')
  } else if (listing.status !== 'published') {
    reasons.push('listing_not_published')
  }
  if (highRisk) reasons.push('org_coverage_unsupported')
  if (action === 'book' && listing.kind === 'event' && listing.startsAt && new Date(listing.startsAt) < now) {
    reasons.push('event_past')
  }
  return result(reasons, [], highRisk)
}

/* ───────────── copy ───────────── */

/** Plain-language reason text for providers, orgs and admins. */
export const REASON_MESSAGES: Record<EligibilityReason, string> = {
  not_a_provider: 'This account isn’t a professional account.',
  account_inactive: 'This account is inactive.',
  application_incomplete: 'The application hasn’t been submitted yet.',
  application_pending: 'The application is still under review.',
  application_rejected: 'The application was not approved.',
  suspended: 'This account is suspended.',
  compliance_hold: 'This account is on hold. Please contact Sanus support.',
  agreement_required: 'The provider agreement hasn’t been accepted yet.',
  credential_expired: 'A license, certification, or ID on file has expired.',
  org_not_approved: 'The organization hasn’t been approved yet.',
  org_agreement_required: 'The organization agreement hasn’t been accepted yet.',
  listing_not_published: 'This listing isn’t published.',
  listing_not_submitted: 'This listing hasn’t been submitted for review.',
  listing_incomplete: 'This listing is missing required details.',
  event_past: 'This event has already happened.',
  malpractice_coverage_required:
    'This listing involves hands-on or in-person care, home visits, prescribing, injectables, or IVs, so a reviewed malpractice insurance document is required first.',
  org_coverage_unsupported:
    'In-person, hands-on, home-visit, and medical-procedure services from organizations can’t be booked on Sanus yet.',
  clinical_ruleset_missing: 'Clinical requests are reviewed by Sanus before they go ahead.',
  client_location_unknown: 'We need the client’s state to check this request.',
  outside_licensed_states: 'This professional isn’t licensed for the client’s state.',
}

export function reasonsMessage(reasons: EligibilityReason[]): string {
  return reasons.map((r) => REASON_MESSAGES[r]).join(' ')
}

/**
 * Wording for the coverage badge. It says only what Sanus reviewed: a
 * document is on file. Not carrier verification, adequacy, or claims review.
 */
export const INSURED_BADGE_LABEL = 'Insurance document on file'
export const INSURED_BADGE_TITLE =
  'Sanus reviewed a malpractice insurance document within its listed dates. Sanus does not verify coverage with the carrier or judge whether coverage is adequate.'
