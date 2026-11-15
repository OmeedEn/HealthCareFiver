// Continuing-education credit claims on event listings. Pure — safe on
// server and client.
//
// The event category ("Continuing education course") never implies
// accreditation. A listing claims credit only when offers_ceu is true, and
// then needs credit type, amount, accreditor / approved provider and its
// identifier before it can go to review or be published. The claim is
// reviewed separately (org_listings.ceu_claim_status, see
// supabase/migrations/20261114100100_availability_timezone_and_event_credit.sql):
// organization approval or listing publication alone never approves it.

export const CEU_DETAIL_KEYS = ['ceu_credit_type', 'ceu_credit_amount', 'ceu_accreditor', 'ceu_accreditor_id'] as const
export type CeuDetailKey = (typeof CEU_DETAIL_KEYS)[number]

export type CeuClaimStatus = 'unreviewed' | 'approved' | 'rejected'

export interface CeuDetails {
  ceu_credit_type?: string | null
  ceu_credit_amount?: string | number | null
  ceu_accreditor?: string | null
  ceu_accreditor_id?: string | null
}

const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')

export function isCreditAmount(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0
  if (typeof v !== 'string') return false
  const t = v.trim()
  return /^\d{1,4}(\.\d{1,2})?$/.test(t) && Number(t) > 0
}

/**
 * What's missing before a listing that offers credit can go to review or be
 * published. Empty when it doesn't offer credit.
 */
export function ceuDetailsMissing(offersCeu: boolean | null | undefined, d: CeuDetails): Record<CeuDetailKey, string> | Record<string, never> {
  if (offersCeu !== true) return {}
  const out: Partial<Record<CeuDetailKey, string>> = {}
  if (blank(d.ceu_credit_type)) out.ceu_credit_type = 'Add the credit type (e.g. ANCC contact hours, AMA PRA Category 1)'
  if (blank(d.ceu_credit_amount)) out.ceu_credit_amount = 'Add how many credits or hours'
  else if (!isCreditAmount(d.ceu_credit_amount)) out.ceu_credit_amount = 'Enter a number like 1 or 1.5'
  if (blank(d.ceu_accreditor)) out.ceu_accreditor = 'Add the accreditor or approved provider'
  if (blank(d.ceu_accreditor_id)) out.ceu_accreditor_id = 'Add the provider or approval number'
  return out as Record<CeuDetailKey, string>
}

/**
 * Public credit label for a listing. Only a claim Sanus has separately
 * reviewed and approved shows as offering credit; nothing is shown
 * publicly otherwise (no badge for "No", none for an unreviewed claim).
 */
export function publicCeuLabel(l: {
  kind: string
  offersCeu: boolean | null
  ceuClaimStatus?: string | null
}): string | null {
  return l.kind === 'event' && l.offersCeu === true && l.ceuClaimStatus === 'approved' ? 'CE credit (reviewed)' : null
}

/** Owner / admin label: what state the claim is in. */
export function ownerCeuLabel(l: { kind: string; offers_ceu: boolean | null; ceu_claim_status?: string | null }): string | null {
  if (l.kind !== 'event' || l.offers_ceu !== true) return null
  if (l.ceu_claim_status === 'approved') return 'CE credit approved by Sanus'
  if (l.ceu_claim_status === 'rejected') return 'CE credit claim not approved'
  return 'CE credit claimed — pending Sanus review'
}
