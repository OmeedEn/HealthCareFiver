import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runComplianceCron } from '@/lib/compliance/cron'
import { resolveAppUrl } from '@/lib/compliance/notify'

/**
 * Daily provider compliance job (Vercel Cron, see vercel.json): malpractice
 * grace reminders + deadline pauses, 60/30-day expiry reminders, lapse holds,
 * and (Mondays) the admin exclusion re-screen digest. Idempotent — safe to
 * re-run. See src/lib/compliance/cron.ts.
 *
 * Auth: Vercel sends `Authorization: Bearer $CRON_SECRET`.
 * Manual run: add `?digest=1` to force the exclusion digest.
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

  try {
    const results = await runComplianceCron(createAdminClient(), {
      appUrl: resolveAppUrl(request.nextUrl.origin),
      forceDigest: request.nextUrl.searchParams.get('digest') === '1',
    })
    return NextResponse.json({ success: true, results })
  } catch (err) {
    console.error('Compliance cron failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
