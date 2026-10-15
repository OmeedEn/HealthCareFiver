import { z } from 'zod'
import { CLIENT_INTEREST_KEYS } from '@/lib/onboarding/client-interests'

// "Continue with Google" on /signup/client leaves the site before the account
// exists, so step 1's answers (interests + location) ride along in a
// short-lived cookie. /onboarding/client/account reads it once the Google
// account is created. A cookie, not a query param: the MFA redirect between
// /callback and that page drops the query string.

export const CLIENT_GOOGLE_ACCOUNT_PATH = '/onboarding/client/account'
export const CLIENT_SIGNUP_COOKIE = 'sanus_client_signup'
export const CLIENT_SIGNUP_COOKIE_MAX_AGE = 60 * 60

export interface ClientSignupAnswers {
  interests: string[]
  city: string | null
  state: string | null
  zip_code: string | null
}

// Lenient on purpose: the cookie is user-controlled, so drop anything invalid
// rather than block the signup.
const answersSchema = z.object({
  interests: z.array(z.string()).max(20).catch([]),
  city: z.string().trim().max(100).nullish().catch(null),
  state: z.string().trim().regex(/^[A-Z]{2}$/).nullish().catch(null),
  zip_code: z.string().trim().regex(/^\d{5}$/).nullish().catch(null),
})

export function parseClientSignupCookie(raw: string | undefined): ClientSignupAnswers {
  let json: unknown = null
  try {
    json = raw ? JSON.parse(decodeURIComponent(raw)) : null
  } catch {
    json = null
  }
  const parsed = answersSchema.safeParse(json ?? {})
  const data = parsed.success ? parsed.data : { interests: [] }
  const allowed = new Set<string>(CLIENT_INTEREST_KEYS)
  return {
    interests: Array.from(new Set(data.interests.filter((i) => allowed.has(i)))),
    city: data.city || null,
    state: data.state || null,
    zip_code: data.zip_code || null,
  }
}

/** Browser only: stash step 1's answers before redirecting to Google. */
export function writeClientSignupCookie(answers: ClientSignupAnswers): void {
  const value = encodeURIComponent(JSON.stringify(answers))
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CLIENT_SIGNUP_COOKIE}=${value}; Path=/; Max-Age=${CLIENT_SIGNUP_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}
