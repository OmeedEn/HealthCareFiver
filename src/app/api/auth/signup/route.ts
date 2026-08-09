import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

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

const contractorSchema = z.object({
  role: z.literal('contractor'),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  contractor_type: z.enum(CONTRACTOR_TYPES),
})

const facilitySchema = z.object({
  role: z.literal('facility'),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  facility_name: z.string().min(1).max(200),
  facility_type: z.enum(FACILITY_TYPES),
  contact_name: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
  zip_code: z.string().regex(/^\d{5}$/),
})

const schema = z.discriminatedUnion('role', [contractorSchema, facilitySchema])

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
    return NextResponse.json(
      { error: 'Please complete all required fields' },
      { status: 400 }
    )
  }

  const body = parsed.data
  const email = body.email.trim().toLowerCase()

  const perIp = await rateLimit(request, {
    bucket: 'signup_ip',
    max: 5,
    windowSeconds: 60 * 60, // 5 accounts/hr/IP is plenty for real users
  })
  if (!perIp.allowed) return tooMany(perIp.retryAfterSeconds)

  const perEmail = await rateLimit(
    request,
    { bucket: 'signup_email', max: 3, windowSeconds: 60 * 60 },
    email
  )
  if (!perEmail.allowed) return tooMany(perEmail.retryAfterSeconds)

  const supabase = await createClient()

  const data =
    body.role === 'contractor'
      ? {
          role: 'contractor' as const,
          first_name: body.first_name.trim(),
          last_name: body.last_name.trim(),
          contractor_type: body.contractor_type,
        }
      : {
          role: 'facility' as const,
          facility_name: body.facility_name.trim(),
          facility_type: body.facility_type,
          contact_name: body.contact_name.trim(),
          city: body.city.trim(),
          state: body.state,
          zip_code: body.zip_code.trim(),
        }

  const { error } = await supabase.auth.signUp({
    email,
    password: body.password,
    options: { data },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
