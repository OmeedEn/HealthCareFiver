import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe/webhooks'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event
  try {
    event = await constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object
      await supabase
        .from('payments')
        .update({
          status: 'in_escrow',
          stripe_charge_id: paymentIntent.latest_charge as string,
          escrowed_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id)
      break
    }

    case 'transfer.created': {
      const transfer = event.data.object
      const contractId = transfer.metadata?.contractId
      if (contractId) {
        await supabase
          .from('payments')
          .update({
            status: 'released',
            stripe_transfer_id: transfer.id,
            released_at: new Date().toISOString(),
          })
          .eq('contract_id', contractId)
          .eq('status', 'in_escrow')
      }
      break
    }

    case 'account.updated': {
      const account = event.data.object
      const userId = account.metadata?.userId
      if (userId) {
        await supabase
          .from('profiles')
          .update({
            stripe_connect_onboarded:
              account.charges_enabled && account.payouts_enabled,
          })
          .eq('id', userId)
      }
      break
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object
      const paymentIntentId = dispute.payment_intent as string
      if (paymentIntentId) {
        await supabase
          .from('payments')
          .update({ status: 'disputed' })
          .eq('stripe_payment_intent_id', paymentIntentId)
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const failedIntent = event.data.object
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          failure_reason:
            failedIntent.last_payment_error?.message || 'Payment failed',
        })
        .eq('stripe_payment_intent_id', failedIntent.id)
      break
    }

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
