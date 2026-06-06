import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Pull Stripe identifiers so we can cancel & detach before nuking the row.
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'stripe_subscription_id, stripe_customer_id, stripe_connect_id'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    const stripe = (() => {
      try {
        return getStripe()
      } catch {
        return null
      }
    })()

    if (stripe) {
      if (profile.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(profile.stripe_subscription_id)
        } catch (err) {
          console.error('Failed to cancel Stripe subscription:', err)
        }
      }
      if (profile.stripe_customer_id) {
        try {
          await stripe.customers.del(profile.stripe_customer_id)
        } catch (err) {
          console.error('Failed to delete Stripe customer:', err)
        }
      }
      if (profile.stripe_connect_id) {
        try {
          // Stripe rejects deletion if the account has a balance; in that case
          // we leave the account in place so payouts can complete.
          await stripe.accounts.del(profile.stripe_connect_id)
        } catch (err) {
          console.error('Failed to delete Stripe Connect account:', err)
        }
      }
    }
  }

  // Deleting the auth.users row cascades through profiles (ON DELETE CASCADE)
  // which cascades into contractor_profiles, facility_profiles, contracts,
  // payments, conversations, messages, reviews, etc.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('Failed to delete auth user:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
