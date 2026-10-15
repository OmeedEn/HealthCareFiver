import { z } from 'zod'
import {
  UNSURE_CREDENTIALS,
  UNSURE_TEAM_SIZES,
  UNSURE_WHAT_YOU_DO_MAX,
} from '@/lib/onboarding/signup-path'

// Not sure answers (Single-Question Onboarding spec, /signup/unsure screens
// 1–4), validated on the server for both the email signup (POST
// /api/auth/signup, role 'unsure') and the Google path (/onboarding/unsure).
// Physical location, "What do you want to do?", city/state and phone are no
// longer asked here: they're collected from the dashboard after staff assign
// a category (classification_requests keeps the old columns, now nullable —
// supabase/migrations/20261016000500_unsure_single_question.sql).

/** Where a brand-new Google account finishes the Not sure signup. */
export const UNSURE_GOOGLE_ACCOUNT_PATH = '/onboarding/unsure'

/** Screen 5's second checkbox (exact spec copy). */
export const UNSURE_REVIEW_CONSENT_LABEL =
  'I confirm this information is accurate and authorize Sanus to review it.'
export const UNSURE_REVIEW_CONSENT_ERROR =
  'Please confirm your information is accurate and authorize Sanus to review it.'

type TeamSize = (typeof UNSURE_TEAM_SIZES)[number]['value']
type Credential = (typeof UNSURE_CREDENTIALS)[number]['value']

function oneOf<T extends string>(options: readonly { value: T }[], message: string) {
  return z.custom<T>(
    (v) => typeof v === 'string' && options.some((o) => o.value === v),
    { message }
  )
}

/** Accepts "linkedin.com/in/…" or a full URL; stored with https://. */
const website = z
  .string()
  .trim()
  .max(300, 'Keep your website or LinkedIn to 300 characters or fewer')
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
    try {
      const url = new URL(withScheme)
      if (!url.hostname.includes('.') || /\s/.test(v)) throw new Error('bad host')
      return withScheme.slice(0, 300)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid website or LinkedIn URL' })
      return z.NEVER
    }
  })

/** True when the text would pass the server's website check (screen 4's Continue). */
export function isValidWebsiteAnswer(v: string): boolean {
  return v.trim() !== '' && website.safeParse(v).success
}

export const unsureAnswersSchema = z.object({
  what_you_do: z
    .string({ error: 'Tell us what you do' })
    .trim()
    .min(1, 'Tell us what you do')
    .max(UNSURE_WHAT_YOU_DO_MAX, `Keep “What do you do?” to ${UNSURE_WHAT_YOU_DO_MAX} characters or fewer`),
  team_size: oneOf<TeamSize>(UNSURE_TEAM_SIZES, 'Tell us whether you work alone or with a team'),
  credential: oneOf<Credential>(UNSURE_CREDENTIALS, 'Tell us whether you hold a license or certification'),
  website,
})

export type UnsureAnswers = z.output<typeof unsureAnswersSchema>
/** What the browser sends (website omitted or null when skipped). */
export type UnsureAnswersInput = z.input<typeof unsureAnswersSchema>

/** classification_requests row for a user. Service-role client only. */
export function classificationRequestRow(userId: string, a: UnsureAnswers, reviewConsentAt: string) {
  return {
    user_id: userId,
    what_you_do: a.what_you_do,
    team_size: a.team_size,
    credential: a.credential,
    website: a.website,
    review_consent_at: reviewConsentAt,
  }
}

/* ───────── "Continue with Google" hand-off ─────────
 * Google leaves the site before the account exists, so screens 1–4 ride
 * along in a short-lived cookie that /onboarding/unsure reads. A cookie, not
 * a query param: the MFA redirect between /callback and that page drops the
 * query string. (Same pattern as src/lib/onboarding/client-google.ts.) */

export const UNSURE_SIGNUP_COOKIE = 'sanus_unsure_signup'
export const UNSURE_SIGNUP_COOKIE_MAX_AGE = 60 * 60

/**
 * The cookie is user-controlled: anything that doesn't pass the server
 * schema counts as missing, and /onboarding/unsure asks the questions again.
 */
export function parseUnsureSignupCookie(raw: string | undefined): UnsureAnswers | null {
  if (!raw) return null
  let json: unknown
  try {
    json = JSON.parse(decodeURIComponent(raw))
  } catch {
    return null
  }
  const parsed = unsureAnswersSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** Browser only: stash screens 1–4 before redirecting to Google. */
export function writeUnsureSignupCookie(answers: UnsureAnswersInput): void {
  const value = encodeURIComponent(JSON.stringify(answers))
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${UNSURE_SIGNUP_COOKIE}=${value}; Path=/; Max-Age=${UNSURE_SIGNUP_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}
