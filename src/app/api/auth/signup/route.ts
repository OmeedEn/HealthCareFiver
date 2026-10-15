import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import {
  CLIENT_INTEREST_KEYS,
  HELP_TIMELINE_VALUES,
  LEGACY_CLIENT_INTERESTS,
  MEETING_FORMAT_VALUES,
  normalizeClientInterests,
} from '@/lib/onboarding/client-interests'
import { writeClientSignupAnswers } from '@/lib/onboarding/client-answers'
import { ORG_AGREEMENT_VERSION, TERMS_VERSION } from '@/lib/legal'
import { authCallbackUrl } from '@/lib/auth/redirect-url'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { ORG_SIGNUP_PATHS, type SignupPath } from '@/lib/onboarding/signup-path'
import {
  ORG_TYPE_KEYS,
  ORG_TYPE_OTHER_MAX,
  facilityTypeEnumFor,
  orgTypesForPath,
} from '@/lib/onboarding/organization'
import {
  UNSURE_REVIEW_CONSENT_ERROR,
  classificationRequestRow,
  unsureAnswersSchema,
} from '@/lib/onboarding/unsure'
import { proAnswersSchema } from '@/lib/onboarding/questions/professional'
import { applyProSignupAnswers } from '@/lib/onboarding/professional-answers'

const LEGACY_INTEREST_KEYS = Object.keys(LEGACY_CLIENT_INTERESTS)

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
  // Single-Question Onboarding: phone moved to the dashboard checklist.
  phone: phone.optional(),
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
  signup_path: z.literal('INDEPENDENT').default('INDEPENDENT'),
  // Screens 1–3 of /signup/professional (held in the browser until now).
  // Written to contractor_profiles right after the account is created.
  answers: proAnswersSchema.optional(),
})

// Organization signup (Single-Question Onboarding spec): screens 1–2
// (organization type and name, held in the browser until now) plus the
// account screen. No title or phone (dashboard items now). One checkbox
// covers the Terms, Privacy Policy and Organization Terms (the Organization
// Agreement), so its version is recorded too. Screens 4–8 happen in
// /onboarding/organization.
const facilitySchema = z
  .object({
    ...consent,
    role: z.literal('facility'),
    email,
    password,
    first_name: firstName,
    last_name: lastName,
    org_terms_version: z.literal(ORG_AGREEMENT_VERSION, {
      error:
        'Our Organization Terms were updated — please refresh the page and review them',
    }),
    // Which door they came through (/signup/organization?source=…). Drives
    // the org type list, the license question and the first-run cards.
    signup_path: z.enum(ORG_SIGNUP_PATHS, 'Choose how you work on the previous screen'),
    org_type: z.enum(ORG_TYPE_KEYS, 'Choose your organization type'),
    org_type_other: z
      .string()
      .trim()
      .max(ORG_TYPE_OTHER_MAX, `Keep it to ${ORG_TYPE_OTHER_MAX} characters`)
      .optional(),
    facility_name: z
      .string({ error: 'Organization name is required' })
      .trim()
      .min(1, 'Organization name is required')
      .max(200, 'Keep the organization name to 200 characters or fewer'),
  })
  .superRefine((d, ctx) => {
    if (!orgTypesForPath(d.signup_path).some((t) => t.value === d.org_type)) {
      ctx.addIssue({ code: 'custom', path: ['org_type'], message: 'Choose one of the listed organization types' })
    }
    if (d.org_type === 'other' && !d.org_type_other) {
      ctx.addIssue({ code: 'custom', path: ['org_type_other'], message: 'Tell us what kind of organization you are' })
    }
  })

const clientSchema = z.object({
  ...consent,
  role: z.literal('client'),
  email,
  password,
  first_name: firstName,
  last_name: lastName,
  // The 11 tiles; legacy keys from a stale tab map forward.
  interests: z
    .array(
      z.enum([...CLIENT_INTEREST_KEYS, ...LEGACY_INTEREST_KEYS], 'Select a valid interest')
    )
    .min(1, 'Pick at least one thing you are looking for')
    .max(11, 'Pick up to 11 interests')
    .transform((keys) => normalizeClientInterests(keys)),
  help_timeline: z.enum(HELP_TIMELINE_VALUES, 'Choose how soon you need help'),
  meeting_formats: z
    .array(z.enum(MEETING_FORMAT_VALUES, 'Choose how you’d like to meet'))
    .max(4)
    .default([]),
  adult_attested: z.literal(true, { error: 'Please confirm you’re 18 or older' }),
  city: z
    .string()
    .trim()
    .max(100, 'City must be 100 characters or fewer')
    .optional(),
  state: stateCode.optional(),
  zip_code: zipCode.optional(),
  signup_path: z.literal('CLIENT').default('CLIENT'),
})

// "Not sure" (/signup/unsure). Not a real role: the account is created as a
// client with signup_path 'UNSURE' (handle_new_user sets
// classification_status 'pending'), and screens 1–4 are filed in
// classification_requests for staff to place the account. No phone: it's
// collected from the dashboard after staff assign a category.
const unsureSchema = z.object({
  ...consent,
  role: z.literal('unsure'),
  email,
  password,
  first_name: firstName,
  last_name: lastName,
  answers: unsureAnswersSchema,
  // "I confirm this information is accurate and authorize Sanus to review it."
  review_consent: z.literal(true, { error: UNSURE_REVIEW_CONSENT_ERROR }),
})

const schema = z.discriminatedUnion(
  'role',
  [contractorSchema, facilitySchema, clientSchema, unsureSchema],
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
  let signupPath: SignupPath
  if (body.role === 'contractor') {
    signupPath = body.signup_path
    data = {
      role: 'contractor' as const,
      first_name: body.first_name,
      last_name: body.last_name,
      // handle_new_user copies this to profiles.phone.
      ...(body.phone ? { phone: body.phone } : {}),
      contractor_type: body.contractor_type,
      // With answers, the category is written after signUp (with the rest
      // of screens 1–3); handle_new_user only knows the four listed ones.
      ...(body.professional_category && !body.answers
        ? { professional_category: body.professional_category }
        : {}),
    }
  } else if (body.role === 'facility') {
    signupPath = body.signup_path
    data = {
      role: 'facility' as const,
      first_name: body.first_name,
      last_name: body.last_name,
      // handle_new_user copies contact_name, facility_name and facility_type
      // to facility_profiles; org_type is written below (and again by
      // /onboarding/organization from this metadata if that write fails).
      contact_name: `${body.first_name} ${body.last_name}`,
      facility_name: body.facility_name,
      facility_type: facilityTypeEnumFor(body.org_type),
      org_type: body.org_type,
      ...(body.org_type === 'other' ? { org_type_other: body.org_type_other } : {}),
      // Organization Terms (Organization Agreement) accepted on the account
      // screen; the post-approval click-through still stamps
      // facility_profiles.org_agreement_accepted_at.
      org_terms_accepted_at: new Date().toISOString(),
      org_terms_version: body.org_terms_version,
    }
  } else if (body.role === 'unsure') {
    signupPath = 'UNSURE'
    data = {
      role: 'client' as const,
      first_name: body.first_name,
      last_name: body.last_name,
    }
  } else {
    signupPath = body.signup_path
    data = {
      role: 'client' as const,
      first_name: body.first_name,
      last_name: body.last_name,
      interests: body.interests,
      ...(body.city ? { city: body.city } : {}),
      ...(body.state ? { state: body.state } : {}),
      ...(body.zip_code ? { zip_code: body.zip_code } : {}),
    }
  }

  // handle_new_user stores this on profiles.signup_path (only when it
  // matches the role).
  data.signup_path = signupPath

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

  // Organization: store screen 1 (handle_new_user doesn't copy org_type).
  // Best effort — /onboarding/organization fills it from metadata otherwise.
  if (body.role === 'facility' && result.user && result.user.identities?.length !== 0) {
    try {
      const admin = createAdminClient()
      const { error: orgError } = await admin
        .from('facility_profiles')
        .update({
          org_type: body.org_type,
          org_type_other: body.org_type === 'other' ? body.org_type_other : null,
        })
        .eq('id', result.user.id)
      if (orgError) throw new Error(`${orgError.code}: ${orgError.message}`)
    } catch (err) {
      console.error('[signup] facility_profiles org_type write failed', {
        userId: result.user.id,
        error: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  // Not sure: file the answers and the review consent for the staff
  // classification queue.
  // An empty identities list is Supabase's obfuscated response for an email
  // that already exists — there is no new account to attach answers to.
  if (body.role === 'unsure' && result.user && result.user.identities?.length !== 0) {
    try {
      const admin = createAdminClient()
      const { error: insertError } = await admin
        .from('classification_requests')
        .insert(classificationRequestRow(result.user.id, body.answers, new Date().toISOString()))
      if (insertError) {
        // code + message only: `details` can echo the row (the answers).
        throw new Error(`${insertError.code}: ${insertError.message}`)
      }
    } catch (err) {
      // The account exists either way (signup_path UNSURE, status pending),
      // so the admin queue still lists the person — just without answers.
      // Don't fail the signup over it.
      console.error('[signup] classification_requests insert failed', {
        userId: result.user.id,
        error: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  // Professional: save screens 1–3 to the new profile (service role; the
  // person may not have a session yet while their email is unconfirmed).
  // Same empty-identities rule as above. A failure doesn't fail the signup:
  // /onboarding/professional asks the missing screens again.
  if (
    body.role === 'contractor' &&
    body.answers &&
    result.user &&
    result.user.identities?.length !== 0
  ) {
    try {
      await applyProSignupAnswers(createAdminClient(), result.user.id, body.answers)
    } catch (err) {
      console.error('[signup] professional answers not saved', {
        userId: result.user.id,
        error: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  // Client: the answers handle_new_user doesn't copy (how soon, how to meet,
  // the 18+ attestation). Same new-account check as above; a failure is
  // logged and never fails the signup (they can be filled in later).
  if (body.role === 'client' && result.user && result.user.identities?.length !== 0) {
    await writeClientSignupAnswers(createAdminClient(), result.user.id, {
      help_timeline: body.help_timeline,
      meeting_formats: body.meeting_formats,
      adult_attested: body.adult_attested,
    })
  }

  // No session means Supabase is waiting on email confirmation (or, with
  // confirmations on, the address already exists and Supabase obfuscates
  // that — either way "check your email" is the right next screen).
  return NextResponse.json({
    success: true,
    needsEmailConfirmation: !result.session,
  })
}
