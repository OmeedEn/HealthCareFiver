import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "Go live" model: professionals join and get verified for free. To be
 * visible/bookable and to apply to jobs they need BOTH:
 *   1. contractor_profiles.verification_status = 'approved'
 *   2. profiles.subscription_status in ('active', 'trialing')  ($29/mo)
 *
 * Use canGoLive() for server-side checks on any action that makes a
 * professional visible or lets them transact (applying to jobs, listings).
 */

export const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const

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
  subscriptionStatus: string | null
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
      .select('verification_status')
      .eq('id', userId)
      .maybeSingle(),
  ])

  const verificationStatus =
    (contractor?.verification_status as string | null | undefined) ?? null
  const subscriptionStatus =
    (profile?.subscription_status as string | null | undefined) ?? null

  return {
    isContractor: profile?.role === 'contractor',
    verificationStatus,
    isApproved: verificationStatus === 'approved',
    subscriptionStatus,
    isSubscribed: isLiveSubscription(subscriptionStatus),
  }
}

export type CanGoLiveResult =
  | { ok: true }
  | { ok: false; reason: 'not_verified' | 'not_subscribed'; message: string }

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

  if (!state.isSubscribed) {
    return {
      ok: false,
      reason: 'not_subscribed',
      message:
        "You're verified! Activate your profile ($29/mo) to go live and apply to jobs.",
    }
  }

  return { ok: true }
}
