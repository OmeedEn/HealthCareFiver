import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentIntent } from '@/lib/stripe/connect'
import { createAdminClient } from '@/lib/supabase/admin'

// Stripe minimum charge is $0.50 USD; cap to keep typos from charging a fortune.
const MIN_AMOUNT_USD = 0.5
const MAX_AMOUNT_USD = 100_000

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { contract_id, timesheet_id, amount } = body

  if (typeof contract_id !== 'string' || !contract_id) {
    return NextResponse.json(
      { error: 'contract_id is required' },
      { status: 400 }
    )
  }

  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < MIN_AMOUNT_USD ||
    amount > MAX_AMOUNT_USD
  ) {
    return NextResponse.json(
      { error: `amount must be a number between ${MIN_AMOUNT_USD} and ${MAX_AMOUNT_USD}` },
      { status: 400 }
    )
  }

  // Fetch contract details
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, title, contractor_id, status, platform_fee_pct')
    .eq('id', contract_id)
    .eq('facility_id', user.id)
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  if (contract.status !== 'active' && contract.status !== 'completed') {
    return NextResponse.json(
      { error: `Cannot pay against contract in status "${contract.status}"` },
      { status: 400 }
    )
  }

  // Get contractor's Stripe Connect account
  const adminSupabase = createAdminClient()
  const { data: contractorProfile } = await adminSupabase
    .from('profiles')
    .select('stripe_connect_id, stripe_connect_onboarded')
    .eq('id', contract.contractor_id)
    .single()

  if (
    !contractorProfile?.stripe_connect_id ||
    !contractorProfile.stripe_connect_onboarded
  ) {
    return NextResponse.json(
      { error: 'Contractor has not completed payment onboarding' },
      { status: 400 }
    )
  }

  // All money math in cents. Avoid drifting against the Stripe-side rounding.
  const amountInCents = Math.round(amount * 100)
  const platformFeePct = contract.platform_fee_pct || 10
  const platformFeeAmountCents = Math.round(
    amountInCents * (platformFeePct / 100)
  )
  const netAmountCents = amountInCents - platformFeeAmountCents

  try {
    const paymentIntent = await createPaymentIntent({
      amount: amountInCents,
      platformFeeAmount: platformFeeAmountCents,
      destinationAccountId: contractorProfile.stripe_connect_id,
      contractId: contract_id,
      description: `Payment for contract: ${contract.title}`,
    })

    const { error: insertError } = await adminSupabase.from('payments').insert({
      contract_id,
      timesheet_id: timesheet_id || null,
      payer_id: user.id,
      payee_id: contract.contractor_id,
      status: 'processing',
      gross_amount: amountInCents / 100,
      platform_fee: platformFeeAmountCents / 100,
      net_amount: netAmountCents / 100,
      stripe_payment_intent_id: paymentIntent.id,
      description: `Payment for contract: ${contract.title}`,
    })

    if (insertError) {
      console.error('Payment row insert failed:', insertError)
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (err) {
    console.error('Error creating payment intent:', err)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}
