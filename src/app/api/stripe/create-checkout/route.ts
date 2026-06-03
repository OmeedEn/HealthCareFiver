import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const priceId = process.env.STRIPE_LISTING_PRICE_ID

  if (!priceId) {
    return NextResponse.json(
      { error: 'Stripe listing price is not configured' },
      { status: 500 }
    )
  }

  // Get or create Stripe customer
  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_status === 'active') {
    return NextResponse.json(
      { error: 'Already subscribed' },
      { status: 400 }
    )
  }

  const stripe = getStripe()
  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    })
    customerId = customer.id

    await adminSupabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?subscribed=true`,
    cancel_url: `${appUrl}/dashboard?subscribed=false`,
    subscription_data: {
      metadata: { userId: user.id },
    },
    metadata: { userId: user.id },
  })

  return NextResponse.json({ url: session.url })
}
