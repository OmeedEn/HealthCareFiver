import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { constructWebhookEvent } from '@/lib/stripe/webhooks'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Idempotency: short-circuit if we've already processed this event.
  // Stripe will retry on non-2xx so we MUST 2xx duplicates.
  const { data: existing } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object
        const { error } = await supabase
          .from('payments')
          .update({
            status: 'in_escrow',
            stripe_charge_id: paymentIntent.latest_charge as string,
            escrowed_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)
        if (error) throw error
        break
      }

      case 'transfer.created': {
        const transfer = event.data.object
        const contractId = transfer.metadata?.contractId
        if (contractId) {
          const { error } = await supabase
            .from('payments')
            .update({
              status: 'released',
              stripe_transfer_id: transfer.id,
              released_at: new Date().toISOString(),
            })
            .eq('contract_id', contractId)
            .eq('status', 'in_escrow')
          if (error) throw error
        }
        break
      }

      case 'account.updated': {
        const account = event.data.object
        const userId = account.metadata?.userId
        if (userId) {
          const { error } = await supabase
            .from('profiles')
            .update({
              stripe_connect_onboarded:
                account.charges_enabled && account.payouts_enabled,
            })
            .eq('id', userId)
          if (error) throw error
        }
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object
        const paymentIntentId = dispute.payment_intent as string
        if (paymentIntentId) {
          const { error } = await supabase
            .from('payments')
            .update({ status: 'disputed' })
            .eq('stripe_payment_intent_id', paymentIntentId)
          if (error) throw error
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const failedIntent = event.data.object
        const { error } = await supabase
          .from('payments')
          .update({
            status: 'failed',
            failure_reason:
              failedIntent.last_payment_error?.message || 'Payment failed',
          })
          .eq('stripe_payment_intent_id', failedIntent.id)
        if (error) throw error
        break
      }

      // ── Subscription lifecycle events ──────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const userId = session.metadata?.userId
          if (userId) {
            const { getStripe } = await import('@/lib/stripe/client')
            const subscription = (await getStripe().subscriptions.retrieve(
              session.subscription as string
            )) as Stripe.Subscription
            const firstItem = subscription.items.data[0]
            const periodEnd = firstItem?.current_period_end
            const { error } = await supabase
              .from('profiles')
              .update({
                subscription_status: 'active',
                stripe_subscription_id: subscription.id,
                subscription_price_id: firstItem?.price.id,
                ...(periodEnd
                  ? {
                      subscription_current_period_end: new Date(
                        periodEnd * 1000
                      ).toISOString(),
                    }
                  : {}),
              })
              .eq('id', userId)
            if (error) throw error
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.userId
        if (userId) {
          const statusMap: Record<string, string> = {
            active: 'active',
            trialing: 'trialing',
            past_due: 'past_due',
            canceled: 'canceled',
            unpaid: 'past_due',
            incomplete: 'inactive',
            incomplete_expired: 'inactive',
            paused: 'inactive',
          }
          const periodEnd = subscription.items.data[0]?.current_period_end
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_status:
                statusMap[subscription.status] || 'inactive',
              ...(periodEnd
                ? {
                    subscription_current_period_end: new Date(
                      periodEnd * 1000
                    ).toISOString(),
                  }
                : {}),
            })
            .eq('id', userId)
          if (error) throw error
        }
        break
      }

      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object
        const userId = deletedSub.metadata?.userId
        if (userId) {
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
            })
            .eq('id', userId)
          if (error) throw error
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark event processed AFTER successful handling. If insert races against a
    // concurrent retry, the unique constraint on id will reject the duplicate.
    await supabase
      .from('stripe_webhook_events')
      .insert({ id: event.id, type: event.type })

    return NextResponse.json({ received: true })
  } catch (err) {
    // Return 500 so Stripe retries the delivery instead of silently dropping it.
    console.error(`Webhook handler failed for ${event.type} (${event.id}):`, err)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
