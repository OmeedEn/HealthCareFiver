import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  LISTING_BASE_COLUMNS,
  LISTING_V3_COLUMNS,
  normalizeListingRow,
  type ListingRow,
} from './offering'
import { isApprovedStatus } from './status'

/**
 * Provider-area reads. Everything here runs with the caller's own (RLS-bound)
 * client and only touches the caller's own rows.
 *
 * Provider onboarding v3 adds columns (insurance_due_at, review_notes, …) in
 * migrations that may land after this code deploys. Reads that include them
 * fall back to the pre-v3 columns on error and treat the new ones as null.
 */

export type ProviderState = {
  verificationStatus: string | null
  verificationNotes: string | null
  agreementAcceptedAt: string | null
  approvedAt: string | null
  insuranceDueAt: string | null
  insuredVerifiedAt: string | null
  complianceHoldReason: string | null
  /** 'approved' or 'insurance_pending' — admin approved the application. */
  isApproved: boolean
  hasAgreement: boolean
  isInsured: boolean
  /** Mirrors SQL can_go_live(): approved + agreement + no compliance hold. */
  canGoLive: boolean
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

export async function getProviderState(
  supabase: SupabaseClient,
  userId: string
): Promise<ProviderState> {
  const [{ data: base }, { data: v3, error: v3Error }] = await Promise.all([
    supabase
      .from('contractor_profiles')
      .select(
        'verification_status, verification_notes, contractor_agreement_accepted_at'
      )
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('contractor_profiles')
      .select(
        'approved_at, insurance_due_at, insured_verified_at, compliance_hold_reason'
      )
      .eq('id', userId)
      .maybeSingle(),
  ])
  const ext = (v3Error ? null : v3) as Record<string, unknown> | null
  const verificationStatus = str(base?.verification_status)
  const agreementAcceptedAt = str(base?.contractor_agreement_accepted_at)
  const insuredVerifiedAt = str(ext?.insured_verified_at)
  const complianceHoldReason = str(ext?.compliance_hold_reason)
  const isApproved = isApprovedStatus(verificationStatus)
  return {
    verificationStatus,
    verificationNotes: str(base?.verification_notes),
    agreementAcceptedAt,
    approvedAt: str(ext?.approved_at),
    insuranceDueAt: str(ext?.insurance_due_at),
    insuredVerifiedAt,
    complianceHoldReason,
    isApproved,
    hasAgreement: agreementAcceptedAt != null,
    isInsured: insuredVerifiedAt != null,
    canGoLive: isApproved && agreementAcceptedAt != null && !complianceHoldReason,
  }
}

export async function listOwnListings(
  supabase: SupabaseClient,
  userId: string
): Promise<ListingRow[]> {
  const run = (cols: string) =>
    supabase
      .from('professional_offerings')
      .select(cols)
      .eq('contractor_id', userId)
      .order('created_at', { ascending: false })
  let { data, error } = await run(`${LISTING_BASE_COLUMNS}, ${LISTING_V3_COLUMNS}`)
  if (error) ({ data, error } = await run(LISTING_BASE_COLUMNS))
  if (error || !data) return []
  return (data as unknown as Record<string, unknown>[]).map(normalizeListingRow)
}

export async function getOwnListing(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<ListingRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const run = (cols: string) =>
    supabase
      .from('professional_offerings')
      .select(cols)
      .eq('id', id)
      .eq('contractor_id', userId)
      .maybeSingle()
  let { data, error } = await run(`${LISTING_BASE_COLUMNS}, ${LISTING_V3_COLUMNS}`)
  if (error) ({ data, error } = await run(LISTING_BASE_COLUMNS))
  if (error || !data) return null
  return normalizeListingRow(data as unknown as Record<string, unknown>)
}
