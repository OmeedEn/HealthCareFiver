#!/usr/bin/env node
/**
 * Dependency-free checks for src/lib/eligibility/rules.ts (synthetic
 * fixtures only; no database, no network).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-eligibility.mjs
 *
 * Needs Node >= 23.6 (built-in TypeScript type stripping), or run with
 * `npx tsx scripts/check-eligibility.mjs` on older Node.
 */
import {
  evaluateOffering,
  evaluateOrgListing,
  hasReviewedCoverage,
  INSURED_BADGE_LABEL,
} from '../src/lib/eligibility/rules.ts'

const NOW = new Date('2026-11-14T12:00:00Z')

const provider = (over = {}) => ({
  role: 'contractor',
  isActive: true,
  verificationStatus: 'approved',
  agreementAcceptedAt: '2026-10-01T00:00:00Z',
  complianceHoldReason: null,
  professionalCategory: 'clinical',
  licenseExpirationDate: '2028-01-01',
  licenseStates: ['CA'],
  telehealthStates: ['NV'],
  insuranceReviewed: false,
  credentials: [{ credential_type: 'license', status: 'verified', expiration_date: '2028-01-01' }],
  ...over,
})
const insured = {
  insuranceReviewed: true,
  credentials: [
    { credential_type: 'license', status: 'verified', expiration_date: '2028-01-01' },
    { credential_type: 'malpractice_insurance', status: 'verified', expiration_date: '2027-06-30' },
  ],
}
const offering = (over = {}) => ({
  kind: 'service',
  status: 'published',
  format: 'virtual',
  involvesMedicalProcedures: false,
  handsOnCare: null,
  ...over,
})

let failed = 0
let passed = 0
function check(name, res, outcome, reason) {
  const ok = res.outcome === outcome && (!reason || res.reasons.includes(reason))
  if (ok) passed++
  else failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${res.outcome}${res.reasons.length ? ` [${res.reasons.join(', ')}]` : ''}`)
}

// Provider states
check('pending provider cannot publish', evaluateOffering('publish', provider({ verificationStatus: 'pending_review' }), offering({ status: 'pending_review' }), NOW), 'ineligible', 'application_pending')
check('pending provider cannot be booked', evaluateOffering('book', provider({ verificationStatus: 'pending_review', professionalCategory: 'consultant' }), offering({ kind: 'consulting' }), NOW), 'ineligible', 'application_pending')
check('more-info provider not visible', evaluateOffering('view', provider({ verificationStatus: 'more_info_requested' }), offering(), NOW), 'ineligible', 'application_pending')
check('rejected provider cannot publish', evaluateOffering('publish', provider({ verificationStatus: 'rejected' }), offering({ status: 'pending_review' }), NOW), 'ineligible', 'application_rejected')
check('not-submitted provider is incomplete', evaluateOffering('submit', provider({ verificationStatus: 'not_submitted' }), offering({ status: 'draft' }), NOW), 'ineligible', 'application_incomplete')
check('suspended provider not visible', evaluateOffering('view', provider({ verificationStatus: 'suspended' }), offering(), NOW), 'ineligible', 'suspended')
check('approved without agreement cannot publish', evaluateOffering('publish', provider({ agreementAcceptedAt: null }), offering({ status: 'pending_review' }), NOW), 'ineligible', 'agreement_required')
check('compliance hold not visible', evaluateOffering('view', provider({ complianceHoldReason: 'manual' }), offering(), NOW), 'ineligible', 'compliance_hold')
check('inactive account not visible', evaluateOffering('view', provider({ isActive: false }), offering(), NOW), 'ineligible', 'account_inactive')
check('expired self-reported license not visible', evaluateOffering('view', provider({ licenseExpirationDate: '2026-11-01', credentials: [{ credential_type: 'license', status: 'verified', expiration_date: '2026-11-01' }] }), offering(), NOW), 'ineligible', 'credential_expired')
check('expired verified certification not visible', evaluateOffering('view', provider({ professionalCategory: 'allied', licenseExpirationDate: null, credentials: [{ credential_type: 'certification', status: 'expired', expiration_date: '2026-10-01' }] }), offering(), NOW), 'ineligible', 'credential_expired')
check('renewed certification cures the lapse', evaluateOffering('view', provider({ professionalCategory: 'allied', licenseExpirationDate: null, credentials: [{ credential_type: 'certification', status: 'expired', expiration_date: '2026-10-01' }, { credential_type: 'certification', status: 'verified', expiration_date: '2028-10-01' }] }), offering(), NOW), 'eligible')

// Nonclinical consulting / malpractice scope
check('nonclinical consulting: no malpractice needed', evaluateOffering('book', provider({ professionalCategory: 'consultant' }), offering({ kind: 'consulting', format: null }), NOW), 'eligible')
check('clinical provider consulting: no malpractice, no clinical review', evaluateOffering('publish', provider(), offering({ kind: 'consulting', format: null, status: 'pending_review' }), NOW), 'eligible')
check('consultant in-person meeting is not in-person care', evaluateOffering('publish', provider({ professionalCategory: 'consultant' }), offering({ format: 'in_person', status: 'pending_review' }), NOW), 'eligible')
check('event (education) is not high-risk', evaluateOffering('view', provider(), offering({ kind: 'event', format: null }), NOW), 'eligible')
check('high-risk in-person care missing coverage cannot publish', evaluateOffering('publish', provider(), offering({ format: 'in_person', status: 'pending_review' }), NOW), 'ineligible', 'malpractice_coverage_required')
check('home visit missing coverage not visible', evaluateOffering('view', provider({ professionalCategory: 'consultant' }), offering({ format: 'home_visit' }), NOW), 'ineligible', 'malpractice_coverage_required')
check('virtual IV/prescribing missing coverage cannot publish', evaluateOffering('publish', provider(), offering({ involvesMedicalProcedures: true, status: 'pending_review' }), NOW), 'ineligible', 'malpractice_coverage_required')
check('insurance_pending (grace) does NOT unlock high-risk', evaluateOffering('publish', provider({ verificationStatus: 'insurance_pending' }), offering({ format: 'in_person', status: 'pending_review' }), NOW), 'ineligible', 'malpractice_coverage_required')
check('insurance_pending can still publish low-risk', evaluateOffering('publish', provider({ verificationStatus: 'insurance_pending' }), offering({ status: 'pending_review' }), NOW), 'eligible')
check('reviewed coverage unlocks high-risk publish', evaluateOffering('publish', provider(insured), offering({ format: 'in_person', status: 'pending_review' }), NOW), 'eligible')
check('expired coverage document blocks high-risk', evaluateOffering('view', provider({ insuranceReviewed: true, credentials: [{ credential_type: 'malpractice_insurance', status: 'verified', expiration_date: '2026-11-01' }] }), offering({ format: 'home_visit' }), NOW), 'ineligible', 'malpractice_coverage_required')
check('coverage needs admin review, not just an upload', { outcome: hasReviewedCoverage(provider({ credentials: insured.credentials }), NOW) ? 'eligible' : 'ineligible', reasons: [] }, 'ineligible')

// Listing state / approval-does-not-publish
check('unpublished (draft) listing cannot be booked', evaluateOffering('book', provider({ professionalCategory: 'consultant' }), offering({ kind: 'consulting', status: 'draft' }), NOW), 'ineligible', 'listing_not_published')
check('pending_review listing not public', evaluateOffering('view', provider(), offering({ status: 'pending_review' }), NOW), 'ineligible', 'listing_not_published')
check('approval does not publish a draft (draft -> published refused)', evaluateOffering('publish', provider(), offering({ status: 'draft' }), NOW), 'ineligible', 'listing_not_submitted')
check('rejected listing cannot be published without resubmission', evaluateOffering('publish', provider(), offering({ status: 'rejected' }), NOW), 'ineligible', 'listing_not_submitted')
check('incomplete draft cannot be submitted', evaluateOffering('submit', provider(), { ...offering({ status: 'draft' }), complete: false }, NOW), 'ineligible', 'listing_incomplete')

// Clinical location (no maintained ruleset -> manual review; out of state -> refused)
check('clinical booking with no client state -> manual review', evaluateOffering('book', provider(), offering(), NOW), 'manual_review', 'client_location_unknown')
check('clinical booking in licensed state -> manual review (no ruleset)', evaluateOffering('book', provider(), offering(), NOW, { clientState: 'CA' }), 'manual_review', 'clinical_ruleset_missing')
check('clinical virtual booking in telehealth state -> manual review', evaluateOffering('book', provider(), offering(), NOW, { clientState: 'nv' }), 'manual_review', 'clinical_ruleset_missing')
check('clinical booking outside licensed states -> refused', evaluateOffering('book', provider(), offering(), NOW, { clientState: 'TX' }), 'ineligible', 'outside_licensed_states')
check('clinical in-person booking ignores telehealth states', evaluateOffering('book', provider(insured), offering({ format: 'in_person' }), NOW, { clientState: 'NV' }), 'ineligible', 'outside_licensed_states')

// Organizations
const org = (over = {}) => ({ verificationStatus: 'approved', agreementAcceptedAt: '2026-10-01T00:00:00Z', ...over })
const orgListing = (over = {}) => ({ kind: 'event', status: 'published', format: 'virtual', startsAt: '2026-12-01T00:00:00Z', handsOnCare: null, involvesMedicalProcedures: null, ...over })
check('unverified org listing cannot be booked', evaluateOrgListing('book', org({ verificationStatus: 'pending_review' }), orgListing(), NOW), 'ineligible', 'org_not_approved')
check('org without agreement cannot publish', evaluateOrgListing('publish', org({ agreementAcceptedAt: null }), orgListing({ status: 'in_review' }), NOW), 'ineligible', 'org_agreement_required')
check('org draft cannot be published directly', evaluateOrgListing('publish', org(), orgListing({ status: 'draft' }), NOW), 'ineligible', 'listing_not_submitted')
check('org virtual event bookable', evaluateOrgListing('book', org(), orgListing(), NOW), 'eligible')
check('org past event not bookable', evaluateOrgListing('book', org(), orgListing({ startsAt: '2026-11-01T00:00:00Z' }), NOW), 'ineligible', 'event_past')
check('org in-person service, risk undeclared -> fail closed', evaluateOrgListing('book', org(), orgListing({ kind: 'service', format: 'in_person' }), NOW), 'ineligible', 'org_coverage_unsupported')
check('org in-person service declared non-hands-on -> bookable', evaluateOrgListing('book', org(), orgListing({ kind: 'service', format: 'in_person', handsOnCare: false, involvesMedicalProcedures: false }), NOW), 'eligible')
check('org IV service -> blocked (no org coverage model)', evaluateOrgListing('publish', org(), orgListing({ kind: 'service', status: 'in_review', involvesMedicalProcedures: true }), NOW), 'ineligible', 'org_coverage_unsupported')

// Copy
check('badge says only what was reviewed', { outcome: INSURED_BADGE_LABEL === 'Insurance document on file' ? 'eligible' : 'ineligible', reasons: [] }, 'eligible')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
