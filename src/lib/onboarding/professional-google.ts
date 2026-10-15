import { proAnswersSchema, type ProAnswersParsed, type ProSignupAnswers } from '@/lib/onboarding/questions/professional'

// "Continue with Google" on /signup/professional leaves the site before the
// account exists, so screens 1–3 ride along in a short-lived cookie (same
// pattern as client-google.ts). /onboarding/account writes them to the new
// contractor profile. A cookie, not a query param: the MFA redirect between
// /callback and that page drops the query string.

export const PRO_SIGNUP_COOKIE = 'sanus_pro_signup'
export const PRO_SIGNUP_COOKIE_MAX_AGE = 60 * 60

/** The cookie is user-controlled: anything that doesn't validate is dropped. */
export function parseProSignupCookie(raw: string | undefined): ProAnswersParsed | null {
  if (!raw) return null
  let json: unknown = null
  try {
    json = JSON.parse(decodeURIComponent(raw))
  } catch {
    return null
  }
  const parsed = proAnswersSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** Browser only: stash screens 1–3 before redirecting to Google. */
export function writeProSignupCookie(answers: ProSignupAnswers): void {
  const value = encodeURIComponent(JSON.stringify(answers))
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${PRO_SIGNUP_COOKIE}=${value}; Path=/; Max-Age=${PRO_SIGNUP_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}
