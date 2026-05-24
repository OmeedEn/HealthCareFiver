import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentIntent } from '@/lib/stripe/connect'
import { createAdminClient } from '@/lib/supabase/admin'

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

  if (!contract_id || !amount) {
    return NextResponse.json(
      { error: 'contract_id and amount are required' },
      { status: 400 }
    )
  }

  // Fetch contract details
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('*, contractor:contractor_id(id, stripe_connect_id)')
    .eq('id', contract_id)
    .eq('facility_id', user.id)
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  // Get contractor's Stripe Connect account
  const adminSupabase = createAdminClient()
  const { data: contractorProfile } = await adminSupabase
    .from('profiles')
    .select('stripe_connect_id, stripe_connect_onboarded')
    .eq('id', contract.contractor_id)
    .single()

  if (!contractorProfile?.stripe_connect_id || !contractorProfile.stripe_connect_onboarded) {
    return NextResponse.json(
      { error: 'Contractor has not completed payment onboarding' },
      { status: 400 }
    )
  }

  const amountInCents = Math.round(amount * 100)
  const platformFeePct = contract.platform_fee_pct || 10
  const platformFeeAmount = Math.round(amountInCents * (platformFeePct / 100))

  try {
    const paymentIntent = await createPaymentIntent({
      amount: amountInCents,
      platformFeeAmount,
      destinationAccountId: contractorProfile.stripe_connect_id,
      contractId: contract_id,
      description: `Payment for contract: ${contract.title}`,
    })

    // Create payment record
    const netAmount = amount - (amount * platformFeePct) / 100
    await adminSupabase.from('payments').insert({
      contract_id,
      timesheet_id: timesheet_id || null,
      payer_id: user.id,
      payee_id: contract.contractor_id,
      status: 'processing',
      gross_amount: amount,
      platform_fee: (amount * platformFeePct) / 100,
      net_amount: netAmount,
      stripe_payment_intent_id: paymentIntent.id,
      description: `Payment for contract: ${contract.title}`,
    })

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
