import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  source: z.enum(['user', 'auto']).default('user'),
  pageUrl: z.string().max(2000).optional(),
  errorDigest: z.string().max(200).optional(),
})

/** File a bug report as the signed-in user. Triaged at /admin/bugs. */
export async function POST(request: NextRequest) {
  if (!getSupabaseConfig()) {
    return NextResponse.json({ ok: true, demo: true })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to report a bug' }, { status: 401 })
  }

  const limit = await rateLimit(request, { bucket: 'bug-report', max: 10, windowSeconds: 3600 }, user.id)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many reports — try again later' }, { status: 429 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please add a short title' }, { status: 400 })
  }
  const body = parsed.data

  const { error } = await supabase.from('bug_reports').insert({
    user_id: user.id,
    title: body.title,
    description: body.description || null,
    severity: body.source === 'auto' ? 'high' : body.severity,
    source: body.source,
    page_url: body.pageUrl ?? null,
    error_digest: body.errorDigest ?? null,
    user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
  })

  if (error) {
    console.error('[bug-reports] insert failed', error)
    return NextResponse.json({ error: 'Could not save the report' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
