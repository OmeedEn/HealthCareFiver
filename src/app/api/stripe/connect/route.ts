import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createConnectAccount, createAccountLink } from '@/lib/stripe/connect'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      const account = await createConnectAccount(user.email!, user.id)
      connectAccountId = account.id

      const { error: updateError } = await supabase
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

    const accountLink = await createAccountLink(connectAccountId)

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect onboarding failed:', err)
    return NextResponse.json(
      { error: 'Failed to start Stripe Connect onboarding' },
      { status: 500 }
    )
  }
}
