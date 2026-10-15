import { isOrgSignupPath, type OrgSignupPath } from '@/lib/onboarding/signup-path'

// "Continue with Google" on /signup/organization?source=… leaves the site
// before the account exists. The door rides along twice: as ?source= on the
// /callback `next` target, and in a short-lived cookie, because the MFA
// redirect between /callback and the account step drops the query string.
// /onboarding/organization/account reads either.

export const ORG_SIGNUP_SOURCE_COOKIE = 'sanus_org_signup_source'
export const ORG_SIGNUP_SOURCE_COOKIE_MAX_AGE = 60 * 60

/** Validated org door, or null. */
export function parseOrgSignupSource(raw: unknown): OrgSignupPath | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return isOrgSignupPath(v) ? v : null
}

/** Browser only: remember the door across the Google round trip. */
export function writeOrgSignupSourceCookie(source: OrgSignupPath) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${ORG_SIGNUP_SOURCE_COOKIE}=${source}; Path=/; Max-Age=${ORG_SIGNUP_SOURCE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}
