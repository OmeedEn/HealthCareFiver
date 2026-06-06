import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
})

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many login attempts. Please wait and try again.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }
  )
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid email or password format' },
      { status: 400 }
    )
  }

  const email = parsed.data.email.trim().toLowerCase()
  const password = parsed.data.password

  // Two buckets: per-IP (stops a single attacker) + per-email (stops a
  // distributed attack against one account).
  const perIp = await rateLimit(request, {
    bucket: 'login_ip',
    max: 10,
    windowSeconds: 60,
  })
  if (!perIp.allowed) return tooMany(perIp.retryAfterSeconds)

  const perEmail = await rateLimit(
    request,
    { bucket: 'login_email', max: 5, windowSeconds: 60 },
    email
  )
  if (!perEmail.allowed) return tooMany(perEmail.retryAfterSeconds)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Don't leak whether the email exists; keep the message generic.
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    )
  }

  return NextResponse.json({ success: true })
}
