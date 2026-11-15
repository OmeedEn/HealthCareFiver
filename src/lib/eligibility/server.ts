import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  evaluateOffering,
  evaluateOrgListing,
  type BookingContext,
  type CredentialFact,
  type EligibilityAction,
  type EligibilityResult,
  type OfferingFacts,
  type OrgFacts,
  type OrgListingFacts,
  type ProviderFacts,
} from './rules'

/**
 * Loads the facts the eligibility rules need and evaluates them. Pass a
 * service-role client (createAdminClient()): these reads cross RLS on
 * purpose (credentials, private org columns) and only a result object leaves
 * this module. Every publish and booking/request-creation point calls
 * checkOffering / checkOrgListing; the database enforces the same rules
 * (20261114100100_eligibility_enforcement.sql), so this is the clear-message
 * layer, not the only one.
 *
 * Columns added by that migration (hands_on_care, org risk flags) may not
 * exist yet; reads fall back without them and treat them as undeclared
 * (null), which the rules handle fail-closed.
 */

type Row = Record<string, unknown>

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length > 0) : []

/** Select with `extra` columns, retrying without them if they aren't migrated yet. */
async function selectOne(
  db: SupabaseClient,
  table: string,
  base: string,
  extra: string,
  id: string
): Promise<Row | null> {
  const run = (cols: string) => db.from(table).select(cols).eq('id', id).maybeSingle()
  let { data, error } = await run(extra ? `${base}, ${extra}` : base)
  if (error && extra) ({ data, error } = await run(base))
  if (error) {
    console.error(`[eligibility] ${table} read failed`, { code: error.code })
    return null
  }
  return (data as Row | null) ?? null
}

export async function loadProviderFacts(db: SupabaseClient, id: string): Promise<ProviderFacts | null> {
  const [{ data: account }, cp, { data: creds }] = await Promise.all([
    db.from('profiles').select('role, is_active').eq('id', id).maybeSingle(),
    selectOne(
      db,
      'contractor_profiles',
      'id, verification_status, contractor_agreement_accepted_at, professional_category, license_state, license_states',
      'compliance_hold_reason, insured_verified_at, license_expiration_date, telehealth_states',
      id
    ),
    db
      .from('credentials')
      .select('credential_type, status, expiration_date')
      .eq('contractor_id', id)
      .in('credential_type', ['license', 'certification', 'government_id', 'malpractice_insurance']),
  ])
  if (!account || !cp) return null
  const licenseState = str(cp.license_state)
  return {
    role: str((account as Row).role),
    isActive: bool((account as Row).is_active),
    verificationStatus: str(cp.verification_status),
    agreementAcceptedAt: str(cp.contractor_agreement_accepted_at),
    complianceHoldReason: str(cp.compliance_hold_reason),
    professionalCategory: str(cp.professional_category),
    licenseExpirationDate: str(cp.license_expiration_date),
    licenseStates: [...(licenseState ? [licenseState] : []), ...strings(cp.license_states)],
    telehealthStates: strings(cp.telehealth_states),
    insuranceReviewed: cp.insured_verified_at != null,
    credentials: ((creds ?? []) as Row[]).map(
      (c): CredentialFact => ({
        credential_type: String(c.credential_type),
        status: String(c.status),
        expiration_date: str(c.expiration_date),
      })
    ),
  }
}

export function toOfferingFacts(r: Row): OfferingFacts {
  const kind = r.kind === 'consulting' || r.kind === 'event' ? r.kind : 'service'
  return {
    kind,
    status: String(r.status ?? 'draft'),
    format: str(r.format),
    involvesMedicalProcedures: bool(r.involves_medical_procedures),
    handsOnCare: bool(r.hands_on_care),
  }
}

export function toOrgListingFacts(r: Row): OrgListingFacts {
  return {
    kind: r.kind === 'event' ? 'event' : 'service',
    status: String(r.status ?? 'draft'),
    format: str(r.format),
    startsAt: str(r.starts_at),
    handsOnCare: bool(r.hands_on_care),
    involvesMedicalProcedures: bool(r.involves_medical_procedures),
  }
}

export type CheckResult = EligibilityResult & { found: boolean }

const NOT_FOUND: CheckResult = { found: false, outcome: 'ineligible', reasons: ['listing_not_published'], highRisk: false }

/** Evaluate `action` for a professional_offerings row. */
export async function checkOffering(
  db: SupabaseClient,
  offeringId: string,
  action: EligibilityAction,
  ctx: BookingContext = {}
): Promise<CheckResult> {
  const row = await selectOne(
    db,
    'professional_offerings',
    'id, contractor_id, kind, status, format, involves_medical_procedures',
    'hands_on_care',
    offeringId
  )
  if (!row) return NOT_FOUND
  const provider = await loadProviderFacts(db, String(row.contractor_id))
  if (!provider) return { ...NOT_FOUND, reasons: ['not_a_provider'] }
  return { found: true, ...evaluateOffering(action, provider, toOfferingFacts(row), new Date(), ctx) }
}

export async function loadOrgFacts(db: SupabaseClient, orgId: string): Promise<OrgFacts | null> {
  const row = await selectOne(db, 'facility_profiles', 'id, verification_status', 'org_agreement_accepted_at', orgId)
  if (!row) return null
  return { verificationStatus: str(row.verification_status), agreementAcceptedAt: str(row.org_agreement_accepted_at) }
}

/** Evaluate `action` for an org_listings row. */
export async function checkOrgListing(
  db: SupabaseClient,
  listingId: string,
  action: EligibilityAction
): Promise<CheckResult & { orgId: string | null }> {
  const row = await selectOne(
    db,
    'org_listings',
    'id, facility_id, kind, status, format, starts_at',
    'hands_on_care, involves_medical_procedures',
    listingId
  )
  if (!row) return { ...NOT_FOUND, orgId: null }
  const orgId = String(row.facility_id)
  const org = await loadOrgFacts(db, orgId)
  return { found: true, orgId, ...evaluateOrgListing(action, org, toOrgListingFacts(row), new Date()) }
}
