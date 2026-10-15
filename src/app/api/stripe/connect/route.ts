import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createConnectAccount,
  createAccountLink,
  isConnectReturnTarget,
  isStripeConfigured,
  type ConnectReturnTarget,
} from '@/lib/stripe/connect'
import { currentUser } from '@/lib/auth/roles'
import {
  PAYOUTS_LOCKED_MESSAGE,
  isApprovedStatus,
} from '@/lib/listings/status'

/**
 * Starts (or resumes) Stripe Connect Express onboarding and returns a
 * Stripe-hosted Account Link URL. Optional JSON body `{ returnTo }` picks a
 * whitelisted return page: 'payments' (default) or 'go-live'. Approved
 * organizations can connect too (to be paid for bookings); they always
 * return to /facility/payouts.
 */
export async function POST(request: NextRequest) {
  // currentUser() enforces AAL2 (MFA) — API routes are outside the proxy,
  // and this route writes a billing column with the service role below.
  const user = await currentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isOrg = user.role === 'facility' || user.role === 'staffing_agency'
  if (user.role !== 'contractor' && !isOrg) {
    return NextResponse.json(
      { error: 'Only professionals and organizations can set up payouts' },
      { status: 403 }
    )
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Payouts aren’t switched on yet. Please check back soon.', code: 'stripe_not_configured' },
      { status: 503 }
    )
  }

  const body: unknown = await request.json().catch(() => null)
  const requested =
    body && typeof body === 'object' && 'returnTo' in body
      ? (body as { returnTo: unknown }).returnTo
      : undefined
  // Organizations always come back to their payouts page.
  const target: ConnectReturnTarget = isOrg
    ? 'org-payouts'
    : isConnectReturnTarget(requested) && requested !== 'org-payouts'
      ? requested
      : 'payments'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  const supabase = await createClient()

  // Payouts unlock only after an admin approves the application
  // (professionals: 'insurance_pending' = approved, inside the malpractice
  // grace period; organizations: 'approved'). Otherwise no Connect account.
  if (isOrg) {
    const { data: org } = await supabase
      .from('facility_profiles')
      .select('verification_status')
      .eq('id', user.id)
      .maybeSingle()
    if (org?.verification_status !== 'approved') {
      return NextResponse.json(
        { error: 'You can set up payouts once your organization is approved.', code: 'not_approved' },
        { status: 403 }
      )
    }
  } else {
    const { data: contractor } = await supabase
      .from('contractor_profiles')
      .select('verification_status')
      .eq('id', user.id)
      .maybeSingle()
    if (!isApprovedStatus(contractor?.verification_status as string | null)) {
      return NextResponse.json(
        { error: PAYOUTS_LOCKED_MESSAGE, code: 'not_approved' },
        { status: 403 }
      )
    }
  }

  // Check if user already has a Connect account
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_id, stripe_connect_onboarded')
    .eq('id', user.id)
    .single()

  if (profile?.stripe_connect_onboarded) {
    return NextResponse.json({ error: 'Already onboarded' }, { status: 400 })
  }

  try {
    let connectAccountId = profile?.stripe_connect_id

    if (!connectAccountId) {
      const account = await createConnectAccount(user.email ?? '', user.id)
      connectAccountId = account.id

      // stripe_connect_id is a protected billing column (trigger
      // profiles_protect_privileged): only the service role may write it.
      const { error: updateError } = await createAdminClient()
        .from('profiles')
        .update({ stripe_connect_id: account.id })
        .eq('id', user.id)
      if (updateError) {
        console.error('Failed to persist Stripe Connect id:', updateError)
        return NextResponse.json(
          { error: 'Failed to save Stripe Connect account' },
          { status: 500 }
        )
      }
    }

    const accountLink = await createAccountLink(connectAccountId, {
      target,
      appUrl,
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect onboarding failed:', err)
    return NextResponse.json(
      { error: 'Failed to start Stripe Connect onboarding' },
      { status: 500 }
    )
  }
}
