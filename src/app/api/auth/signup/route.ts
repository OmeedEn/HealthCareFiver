import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { CLIENT_INTEREST_KEYS } from '@/lib/onboarding/client-interests'
import { TERMS_VERSION } from '@/lib/legal'
import { authCallbackUrl } from '@/lib/auth/redirect-url'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'

// Must stay in sync with the `contractor_type` / `facility_type` Postgres
// enums (supabase/migrations/20250523000001_create_enums.sql). The DB is the
// real signup boundary, so reject unknown values here with a clean 400 rather
// than letting the auth.signUp call fail with an opaque enum-cast error.
const CONTRACTOR_TYPES = [
  'rn', 'lpn', 'cna', 'np', 'pa', 'md', 'do',
  'pt', 'ot', 'slp', 'rt', 'pharm', 'rad_tech',
  'lab_tech', 'ma', 'emt', 'sw', 'other',
] as const


const PROFESSIONAL_CATEGORIES = [
  'clinical', 'allied', 'consultant', 'educator',
] as const

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .email('Enter a valid email address')
  .max(254, 'Email must be 254 characters or fewer')
const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password must be 200 characters or fewer')
const firstName = z
  .string({ error: 'First name is required' })
  .trim()
  .min(1, 'First name is required')
  .max(100, 'First name must be 100 characters or fewer')
const lastName = z
  .string({ error: 'Last name is required' })
  .trim()
  .min(1, 'Last name is required')
  .max(100, 'Last name must be 100 characters or fewer')
const stateCode = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/, 'Select a valid state')
// US phone, normalized to E.164 (+1XXXXXXXXXX) — see src/lib/phone.ts.
const phone = z
  .string({ error: 'Phone number is required' })
  .trim()
  .min(1, 'Phone number is required')
  .max(32, PHONE_ERROR)
  .transform((v, ctx) => {
    const normalized = normalizeUsPhone(v)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: PHONE_ERROR })
      return z.NEVER
    }
    return normalized
  })
const zipCode = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'Enter a 5-digit ZIP code')

// Explicit consent to the current Terms of Service + Privacy Policy. The
// version must match what this deploy serves so we know exactly which text
// the user agreed to; a stale tab gets a clear "refresh" message.
const consent = {
  accepted_terms: z.literal(true, {
    error: 'Please agree to the Terms of Service and Privacy Policy to continue',
  }),
  terms_version: z.literal(TERMS_VERSION, {
    error:
      'Our Terms of Service or Privacy Policy were updated — please refresh the page and review them',
  }),
}

const contractorSchema = z.object({
  ...consent,
  role: z.literal('contractor'),
  email,
  password,
  first_name: firstName,
  last_name: lastName,
  phone,
  // The granular license type is captured later in onboarding; 'other'
  // keeps the contractor_type enum happy at signup.
  contractor_type: z
    .enum(CONTRACTOR_TYPES, 'Select a valid profession')
    .default('other'),
  // Category is chosen in step 2 of /onboarding/professional now; still
  // accepted here for older clients.
  professional_category: z
    .enum(PROFESSIONAL_CATEGORIES, 'Select a valid professional category')
    .optional(),
})

// Organization signup is step 1 of the Organization Onboarding spec: just
// the account. Steps 2-4 (organization details, verification, intents)
// happen in /onboarding/organization after the email is confirmed.
const facilitySchema = z.object({
  ...consent,
  role: z.literal('facility'),
  email,
  password,
  first_name: firstName,
  last_name: lastName,
  title: z
    .string({ error: 'Your role or title is required' })
    .trim()
    .min(1, 'Your role or title is required')
    .max(100, 'Keep your title to 100 characters or fewer'),
  phone,
})

const clientSchema = z.object({
  ...consent,
  role: z.literal('client'),
  email,
  password,
  first_name: firstName,
  last_name: lastName,
  interests: z
    .array(z.enum(CLIENT_INTEREST_KEYS, 'Select a valid interest'))
    .min(1, 'Pick at least one thing you are looking for')
    .max(10, 'Pick up to 10 interests'),
  city: z
    .string()
    .trim()
    .max(100, 'City must be 100 characters or fewer')
    .optional(),
  state: stateCode.optional(),
  zip_code: zipCode.optional(),
})

const schema = z.discriminatedUnion(
  'role',
  [contractorSchema, facilitySchema, clientSchema],
  { error: 'Choose an account type' }
)

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many signup attempts. Please wait and try again.' },
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
    // Surface the first problem in plain language so the form can show it.
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first?.message || 'Please complete all required fields' },
      { status: 400 }
    )
  }

  const body = parsed.data
  const normalizedEmail = body.email.toLowerCase()

  const perIp = await rateLimit(request, {
    bucket: 'signup_ip',
    max: 5,
    windowSeconds: 60 * 60, // 5 accounts/hr/IP is plenty for real users
  })
  if (!perIp.allowed) return tooMany(perIp.retryAfterSeconds)

  const perEmail = await rateLimit(
    request,
    { bucket: 'signup_email', max: 3, windowSeconds: 60 * 60 },
    normalizedEmail
  )
  if (!perEmail.allowed) return tooMany(perEmail.retryAfterSeconds)

  const supabase = await createClient()

  let data: Record<string, unknown>
  if (body.role === 'contractor') {
    data = {
      role: 'contractor' as const,
      first_name: body.first_name,
      last_name: body.last_name,
      // handle_new_user copies this to profiles.phone.
      phone: body.phone,
      contractor_type: body.contractor_type,
      ...(body.professional_category
        ? { professional_category: body.professional_category }
        : {}),
    }
  } else if (body.role === 'facility') {
    data = {
      role: 'facility' as const,
      first_name: body.first_name,
      last_name: body.last_name,
      // handle_new_user copies contact_name to facility_profiles and phone to
      // profiles.phone; the wizard copies contact_title on its first load.
      contact_name: `${body.first_name} ${body.last_name}`,
      contact_title: body.title,
      phone: body.phone,
    }
  } else {
    data = {
      role: 'client' as const,
      first_name: body.first_name,
      last_name: body.last_name,
      interests: Array.from(new Set(body.interests)),
      ...(body.city ? { city: body.city } : {}),
      ...(body.state ? { state: body.state } : {}),
      ...(body.zip_code ? { zip_code: body.zip_code } : {}),
    }
  }

  // Consent record: server timestamp (never trust a client clock) plus the
  // exact terms version shown.
  data.terms_accepted_at = new Date().toISOString()
  data.terms_version = body.terms_version

  const { data: result, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: body.password,
    options: {
      data,
      // When email confirmations are on, the link must go through /callback
      // (PKCE code exchange) rather than the bare Site URL.
      // Professionals land straight in the onboarding wizard.
      emailRedirectTo: authCallbackUrl(
        request,
        body.role === 'contractor'
          ? '/onboarding/professional'
          : body.role === 'facility'
            ? '/onboarding/organization'
            : '/dashboard'
      ),
    },
  })

  if (error) {
    if (
      error.code === 'user_already_exists' ||
      /already registered/i.test(error.message)
    ) {
      return NextResponse.json(
        {
          error:
            'An account with this email already exists — sign in instead.',
        },
        { status: 409 }
      )
    }
    if (error.code === 'weak_password') {
      // GoTrue's password-policy message is user-facing and safe to show.
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      // Supabase couldn't send the confirmation email (project-wide email
      // quota). Log it — it means SMTP needs attention — but tell the user
      // plainly that it's temporary.
      console.error('[signup] email send rate limit hit', {
        role: body.role,
        code: error.code,
      })
      return NextResponse.json(
        {
          error:
            'We’re getting a lot of sign-ups right now and couldn’t send your confirmation email. Please try again in a few minutes.',
        },
        { status: 429, headers: { 'Retry-After': '300' } }
      )
    }
    // Anything else (e.g. "Database error saving new user") is internal —
    // log it, but don't leak it to the client.
    console.error('[signup] auth.signUp failed', {
      role: body.role,
      status: error.status,
      code: error.code,
      message: error.message,
    })
    return NextResponse.json(
      { error: 'We couldn’t create your account. Please try again.' },
      { status: 500 }
    )
  }

  // No session means Supabase is waiting on email confirmation (or, with
  // confirmations on, the address already exists and Supabase obfuscates
  // that — either way "check your email" is the right next screen).
  return NextResponse.json({
    success: true,
    needsEmailConfirmation: !result.session,
  })
}
