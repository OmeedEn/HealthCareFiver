import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createConnectAccount,
  createAccountLink,
  isConnectReturnTarget,
  type ConnectReturnTarget,
} from '@/lib/stripe/connect'
import { currentUser } from '@/lib/auth/roles'

/**
 * Starts (or resumes) Stripe Connect Express onboarding and returns a
 * Stripe-hosted Account Link URL. Optional JSON body `{ returnTo }` picks a
 * whitelisted return page: 'payments' (default) or 'go-live'.
 */
export async function POST(request: NextRequest) {
  // currentUser() enforces AAL2 (MFA) — API routes are outside the proxy,
  // and this route writes a billing column with the service role below.
  const user = await currentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== 'contractor') {
    return NextResponse.json(
      { error: 'Only professionals can set up payouts' },
      { status: 403 }
    )
  }

  const body: unknown = await request.json().catch(() => null)
  const requested =
    body && typeof body === 'object' && 'returnTo' in body
      ? (body as { returnTo: unknown }).returnTo
      : undefined
  const target: ConnectReturnTarget = isConnectReturnTarget(requested)
    ? requested
    : 'payments'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  const supabase = await createClient()

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
