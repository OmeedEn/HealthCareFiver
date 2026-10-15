import { isOrgSignupPath, type OrgSignupPath } from '@/lib/onboarding/signup-path'

// "Continue with Google" on /signup/organization?source=… leaves the site
// before the account exists. The door rides along twice: as ?source= on the
// /callback `next` target, and in a short-lived cookie, because the MFA
// redirect between /callback and the account step drops the query string.
// Screens 1–2 (organization type and name) ride in a second short-lived
// cookie. /onboarding/organization/account reads both; if the answers are
// lost, /onboarding/organization simply asks screens 1–2 again.

export const ORG_SIGNUP_SOURCE_COOKIE = 'sanus_org_signup_source'
export const ORG_SIGNUP_ANSWERS_COOKIE = 'sanus_org_signup_answers'
export const ORG_SIGNUP_SOURCE_COOKIE_MAX_AGE = 60 * 60

/** Validated org door, or null. */
export function parseOrgSignupSource(raw: unknown): OrgSignupPath | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return isOrgSignupPath(v) ? v : null
}

/** Screens 1–2 answered before the account existed. */
export interface OrgPreAccountAnswers {
  org_type: string
  org_type_other: string
  facility_name: string
}

/** Lenient parse of the answers cookie (values are re-validated where they're saved). */
export function parseOrgSignupAnswers(raw: string | undefined | null): OrgPreAccountAnswers | null {
  if (!raw) return null
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>
    const s = (k: string, max: number) => (typeof v[k] === 'string' ? (v[k] as string).trim().slice(0, max) : '')
    return { org_type: s('org_type', 40), org_type_other: s('org_type_other', 100), facility_name: s('facility_name', 200) }
  } catch {
    return null
  }
}

function writeCookie(name: string, value: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${value}; Path=/; Max-Age=${ORG_SIGNUP_SOURCE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

/** Browser only: remember the door (and screens 1–2) across the Google round trip. */
export function writeOrgSignupSourceCookie(source: OrgSignupPath, answers?: OrgPreAccountAnswers) {
  writeCookie(ORG_SIGNUP_SOURCE_COOKIE, source)
  if (answers) writeCookie(ORG_SIGNUP_ANSWERS_COOKIE, encodeURIComponent(JSON.stringify(answers)))
}
