import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email().max(254),
  redirectTo: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    // Always return 200 to avoid leaking email validity / format details.
    return NextResponse.json({ success: true })
  }

  const email = parsed.data.email.trim().toLowerCase()

  const perIp = await rateLimit(request, {
    bucket: 'forgot_ip',
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
    { bucket: 'forgot_email', max: 3, windowSeconds: 60 * 60 },
    email
  )
  if (!perEmail.allowed) {
    // Quietly succeed: don't reveal that we've already sent emails to this
    // address. The user will see the same neutral "check your email" UI.
    return NextResponse.json({ success: true })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: parsed.data.redirectTo,
  })

  if (error) {
    // Log internally; always respond success so we don't leak account state.
    console.error('Password reset failed:', error)
  }

  return NextResponse.json({ success: true })
}
