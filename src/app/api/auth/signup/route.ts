import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { CLIENT_INTEREST_KEYS } from '@/lib/onboarding/client-interests'

// Must stay in sync with the `contractor_type` / `facility_type` Postgres
// enums (supabase/migrations/20250523000001_create_enums.sql). The DB is the
// real signup boundary, so reject unknown values here with a clean 400 rather
// than letting the auth.signUp call fail with an opaque enum-cast error.
const CONTRACTOR_TYPES = [
  'rn', 'lpn', 'cna', 'np', 'pa', 'md', 'do',
  'pt', 'ot', 'slp', 'rt', 'pharm', 'rad_tech',
  'lab_tech', 'ma', 'emt', 'sw', 'other',
] as const

const FACILITY_TYPES = [
  'hospital', 'clinic', 'nursing_home', 'assisted_living',
  'home_health', 'rehab_center', 'urgent_care', 'telehealth',
  'staffing_agency', 'other',
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
const zipCode = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'Enter a 5-digit ZIP code')

const contractorSchema = z.object({
  role: z.literal('contractor'),
  email,
  password,
  first_name: firstName,
  last_name: lastName,
  contractor_type: z.enum(CONTRACTOR_TYPES, 'Select a valid profession'),
  professional_category: z
    .enum(PROFESSIONAL_CATEGORIES, 'Select a valid professional category')
    .optional(),
})

const facilitySchema = z.object({
  role: z.literal('facility'),
  email,
  password,
  facility_name: z
    .string({ error: 'Organization name is required' })
    .trim()
    .min(1, 'Organization name is required')
    .max(200, 'Organization name must be 200 characters or fewer'),
  facility_type: z.enum(FACILITY_TYPES, 'Select a valid organization type'),
  contact_name: z
    .string({ error: 'Contact name is required' })
    .trim()
    .min(1, 'Contact name is required')
    .max(200, 'Contact name must be 200 characters or fewer'),
  city: z
    .string({ error: 'City is required' })
    .trim()
    .min(1, 'City is required')
    .max(100, 'City must be 100 characters or fewer'),
  state: stateCode,
  zip_code: zipCode,
})

const clientSchema = z.object({
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
      contractor_type: body.contractor_type,
      ...(body.professional_category
        ? { professional_category: body.professional_category }
        : {}),
    }
  } else if (body.role === 'facility') {
    data = {
      role: 'facility' as const,
      facility_name: body.facility_name,
      facility_type: body.facility_type,
      contact_name: body.contact_name,
      city: body.city,
      state: body.state,
      zip_code: body.zip_code,
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

  const { error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: body.password,
    options: { data },
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

  return NextResponse.json({ success: true })
}
