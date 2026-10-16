'use server'

import { currentUser } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createExpressDashboardLink, isStripeConfigured } from '@/lib/stripe/connect'

/** One-time link into the organization's Stripe Express Dashboard. */
export async function openStripeDashboard(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await currentUser()
  if (!user || (user.role !== 'facility' && user.role !== 'staffing_agency')) {
    return { ok: false, error: 'Please sign in again.' }
  }
  if (!isStripeConfigured()) return { ok: false, error: 'Payouts aren’t switched on yet.' }
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('stripe_connect_id').eq('id', user.id).single()
  if (!data?.stripe_connect_id) return { ok: false, error: 'Set up payouts first.' }
  try {
    return { ok: true, url: await createExpressDashboardLink(data.stripe_connect_id) }
  } catch (err) {
    console.error('[facility/payouts] dashboard link failed', err)
    return { ok: false, error: 'We couldn’t open Stripe right now. Please try again.' }
  }
}
