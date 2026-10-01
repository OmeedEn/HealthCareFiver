import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "Go live" model: professionals join and get verified for free (a small
 * service fee applies to each booking). To be visible/bookable and to apply
 * to jobs they need BOTH:
 *   1. contractor_profiles.verification_status = 'approved'
 *   2. contractor_profiles.contractor_agreement_accepted_at IS NOT NULL
 *      (set only via the accept_contractor_agreement RPC on /go-live)
 * Stripe Connect payouts are needed to get paid but are NOT a go-live gate.
 *
 * Mirrors SQL can_go_live(uuid) (20260930000013). Use canGoLive() for
 * server-side checks on any action that makes a professional visible or lets
 * them transact (applying to jobs, listings).
 */

/**
 * @deprecated The $29/mo subscription is no longer part of go-live. Kept only
 * until remaining call sites are removed.
 */
export const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const

/**
 * @deprecated The $29/mo subscription is no longer part of go-live. Kept only
 * until remaining call sites are removed.
 */
export function isLiveSubscription(status: string | null | undefined): boolean {
  return (
    status != null &&
    (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
  )
}

export type GoLiveState = {
  isContractor: boolean
  verificationStatus: string | null
  isApproved: boolean
  agreementAcceptedAt: string | null
  agreementVersion: string | null
  hasAcceptedAgreement: boolean
  /** True when the professional can go live (approved + agreement). */
  isLive: boolean
  /** @deprecated Subscription no longer gates go-live. */
  subscriptionStatus: string | null
  /** @deprecated Subscription no longer gates go-live. */
  isSubscribed: boolean
}

/** Raw state behind canGoLive — for UI that needs to branch on each part. */
export async function getGoLiveState(
  supabase: SupabaseClient,
  userId: string
): Promise<GoLiveState> {
  const [{ data: profile }, { data: contractor }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, subscription_status')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('contractor_profiles')
      .select(
        'verification_status, contractor_agreement_accepted_at, contractor_agreement_version'
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
  const subscriptionStatus =
    (profile?.subscription_status as string | null | undefined) ?? null

  const isApproved = verificationStatus === 'approved'
  const hasAcceptedAgreement = agreementAcceptedAt != null

  return {
    isContractor,
    verificationStatus,
    isApproved,
    agreementAcceptedAt,
    agreementVersion,
    hasAcceptedAgreement,
    isLive: isContractor && isApproved && hasAcceptedAgreement,
    subscriptionStatus,
    isSubscribed: isLiveSubscription(subscriptionStatus),
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
