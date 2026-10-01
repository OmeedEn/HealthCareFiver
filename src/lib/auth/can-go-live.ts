import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "Go live" model: professionals join and get verified for free (a small
 * service fee applies to each booking). To be visible/bookable and to apply
 * to jobs they need ALL of:
 *   1. contractor_profiles.verification_status IN ('approved',
 *      'insurance_pending') — insurance_pending = approved but inside the
 *      malpractice grace period; they are live, but listings that require
 *      malpractice can't publish until is_insured().
 *   2. contractor_profiles.contractor_agreement_accepted_at IS NOT NULL
 *      (set only via the accept_contractor_agreement RPC on /go-live)
 *   3. contractor_profiles.compliance_hold_reason IS NULL (admin hold)
 * 'suspended', 'rejected', 'pending_review', 'more_info_requested' and
 * 'not_submitted' are never live. Stripe Connect payouts are needed to get
 * paid but are NOT a go-live gate.
 *
 * Mirrors SQL can_go_live(uuid) (20261001000202). Use canGoLive() for
 * server-side checks on any action that makes a professional visible or lets
 * them transact (applying to jobs, listings).
 */

/** verification_status values that count as approved for go-live. */
export const LIVE_VERIFICATION_STATUSES = ['approved', 'insurance_pending'] as const

export type GoLiveState = {
  isContractor: boolean
  verificationStatus: string | null
  /** approved OR insurance_pending. */
  isApproved: boolean
  /** Approved, inside the malpractice grace period. */
  isInsurancePending: boolean
  /** Admin compliance hold (or suspended): not live regardless of the rest. */
  isOnHold: boolean
  complianceHoldReason: string | null
  agreementAcceptedAt: string | null
  agreementVersion: string | null
  hasAcceptedAgreement: boolean
  /**
   * An admin has reviewed malpractice coverage (insured_verified_at set).
   * Badge/UI hint only — the authoritative check (also requires a verified,
   * unexpired malpractice_insurance credential) is SQL is_insured(uuid).
   */
  isInsured: boolean
  /** True when the professional can go live. */
  isLive: boolean
}

/** Raw state behind canGoLive — for UI that needs to branch on each part. */
export async function getGoLiveState(
  supabase: SupabaseClient,
  userId: string
): Promise<GoLiveState> {
  const [{ data: profile }, { data: contractor }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('contractor_profiles')
      .select(
        'verification_status, contractor_agreement_accepted_at, contractor_agreement_version, compliance_hold_reason, insured_verified_at'
      )
      .eq('id', userId)
      .maybeSingle(),
  ])

  const isContractor = profile?.role === 'contractor'
  const verificationStatus =
    (contractor?.verification_status as string | null | undefined) ?? null
  const agreementAcceptedAt =
    (contractor?.contractor_agreement_accepted_at as
      | string
      | null
      | undefined) ?? null
  const agreementVersion =
    (contractor?.contractor_agreement_version as string | null | undefined) ??
    null
  const complianceHoldReason =
    (contractor?.compliance_hold_reason as string | null | undefined) ?? null
  const insuredVerifiedAt =
    (contractor?.insured_verified_at as string | null | undefined) ?? null

  const isApproved = (LIVE_VERIFICATION_STATUSES as readonly string[]).includes(
    verificationStatus ?? ''
  )
  const isInsurancePending = verificationStatus === 'insurance_pending'
  const isOnHold =
    verificationStatus === 'suspended' || complianceHoldReason != null
  const hasAcceptedAgreement = agreementAcceptedAt != null

  return {
    isContractor,
    verificationStatus,
    isApproved,
    isInsurancePending,
    isOnHold,
    complianceHoldReason,
    agreementAcceptedAt,
    agreementVersion,
    hasAcceptedAgreement,
    isInsured: insuredVerifiedAt != null,
    isLive:
      isContractor &&
      isApproved &&
      hasAcceptedAgreement &&
      complianceHoldReason == null,
  }
}

export type GoLiveBlockReason = 'not_verified' | 'agreement_required'

export type CanGoLiveResult =
  | { ok: true }
  | { ok: false; reason: GoLiveBlockReason; message: string }

export async function canGoLive(
  supabase: SupabaseClient,
  userId: string
): Promise<CanGoLiveResult> {
  const state = await getGoLiveState(supabase, userId)

  if (state.isContractor && state.isOnHold) {
    // Same reason code as SQL (HINT 'not_verified') so callers keep working.
    return {
      ok: false,
      reason: 'not_verified',
      message: 'Your account is on hold. Please contact Sanus support.',
    }
  }

  if (!state.isContractor || !state.isApproved) {
    return {
      ok: false,
      reason: 'not_verified',
      message:
        'Your credentials need to be verified before you can go live. You can apply once your verification is approved.',
    }
  }

  if (!state.hasAcceptedAgreement) {
    return {
      ok: false,
      reason: 'agreement_required',
      message: 'Accept the contractor agreement to start applying',
    }
  }

  return { ok: true }
}
