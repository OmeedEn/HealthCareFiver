import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentUser } from '@/lib/auth/roles'
import { getGoLiveState } from '@/lib/auth/can-go-live'

// $29/mo "go live" subscription. Only approved professionals may buy it:
// joining and verification are free, and the plan does nothing for anyone else.
export async function POST() {
  // currentUser() enforces AAL2 (MFA) — API routes are outside the proxy.
  const user = await currentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== 'contractor') {
    return NextResponse.json(
      { error: 'Only healthcare professionals can activate a profile.' },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  const goLive = await getGoLiveState(supabase, user.id)

  if (!goLive.isApproved) {
    return NextResponse.json(
      {
        error:
          'Your credentials must be verified before you can activate your profile.',
      },
      { status: 403 }
    )
  }

  if (goLive.isSubscribed) {
    return NextResponse.json(
      { error: 'Your profile is already active.' },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const priceId = process.env.STRIPE_LISTING_PRICE_ID

  if (!appUrl || !priceId) {
    return NextResponse.json(
      { error: 'Stripe checkout is not configured' },
      { status: 500 }
    )
  }

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  try {
    const stripe = getStripe()
    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      })
      customerId = customer.id

      const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
      if (updateError) {
        console.error('Failed to persist Stripe customer id:', updateError)
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?subscribed=true`,
      // Back to the offer, which itself links to the dashboard ("Not now").
      cancel_url: `${appUrl}/subscribe`,
      subscription_data: {
        metadata: { userId: user.id },
      },
      metadata: { userId: user.id },
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout creation failed:', err)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
