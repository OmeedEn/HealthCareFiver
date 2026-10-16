import { NextRequest, NextResponse } from 'next/server'
import { isStripeConfigured } from '@/lib/stripe/connect'
import { runBookingMoneyJobs } from '@/lib/bookings/payments'

/**
 * Daily organization-booking money job (Vercel Cron, see vercel.json):
 * pays organizations 48 hours after their bookings, retries pending refunds,
 * and releases accepted bookings nobody paid for. Idempotent.
 *
 * Auth: Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ success: true, skipped: 'Stripe is not configured' })
  }

  try {
    const results = await runBookingMoneyJobs()
    return NextResponse.json({ success: true, results })
  } catch (err) {
    console.error('Booking payouts cron failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
