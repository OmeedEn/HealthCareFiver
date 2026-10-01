import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { authCallbackUrl } from '@/lib/auth/redirect-url'

const schema = z.object({
  email: z.string().trim().email().max(254),
})

// Re-sends the signup confirmation email. Always answers with the same
// neutral success so callers can't probe which addresses have (unconfirmed)
// accounts; only rate limiting is surfaced, and only per-IP.
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ success: true })
  }

  const email = parsed.data.email.toLowerCase()

  const perIp = await rateLimit(request, {
    bucket: 'resend_confirm_ip',
    max: 5,
    windowSeconds: 60 * 60,
  })
  if (!perIp.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(perIp.retryAfterSeconds) },
      }
    )
  }

  const perEmail = await rateLimit(
    request,
    { bucket: 'resend_confirm_email', max: 3, windowSeconds: 60 * 60 },
    email
  )
  if (!perEmail.allowed) {
    // Quietly succeed so the response doesn't reveal prior sends.
    return NextResponse.json({ success: true })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authCallbackUrl(request, '/dashboard') },
  })

  if (error) {
    // Log internally; never tell the caller whether the address exists.
    console.error('[resend-confirmation] auth.resend failed', {
      status: error.status,
      code: error.code,
    })
  }

  return NextResponse.json({ success: true })
}
