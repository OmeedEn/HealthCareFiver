// Validation for the "where to go after signing in" destination that rides
// through login, signup, Google OAuth (/callback?next=) and email
// confirmation. Shared by the proxy, route handlers, server actions and
// client pages, so it has no server-only imports.
//
// Only same-origin relative paths are accepted: must start with a single
// "/", never "//" or "/\" (browsers treat both like a protocol-relative
// URL), no backslashes or control characters anywhere, bounded length, and
// it must still resolve to the same origin after URL parsing. Auth pages
// themselves are refused so a destination can never loop back into sign-in.
// The value is a path only: never put credentials, tokens or health details
// in it.

/** httpOnly cookie holding a validated return path across sign-up/sign-in. */
export const RETURN_TO_COOKIE = 'sanus_return_to'
/** Short-lived: long enough for an email confirmation or Google round trip. */
export const RETURN_TO_COOKIE_MAX_AGE = 30 * 60

const MAX_LEN = 512
const PROBE_ORIGIN = 'https://sanus.invalid'
// Destinations that would loop back into authentication.
const AUTH_PREFIXES = ['/login', '/signup', '/callback', '/mfa', '/forgot-password', '/reset-password']

/** Post-login hop the proxy resolves to the right landing page (src/proxy.ts). */
export const LOGIN_CONTINUE_PATH = '/login/continue'

export function safeNextPath(target: unknown): string | null {
  if (typeof target !== 'string') return null
  if (target.length === 0 || target.length > MAX_LEN) return null
  if (!target.startsWith('/') || target.startsWith('//')) return null
  if (target.includes('\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(target)) return null
  let url: URL
  try {
    url = new URL(target, PROBE_ORIGIN)
  } catch {
    return null
  }
  if (url.origin !== PROBE_ORIGIN) return null
  // Dot segments can normalize "/..//evil.com" into "//evil.com": re-check
  // the normalized path, not just the input.
  if (url.pathname.startsWith('//')) return null
  if (url.pathname === LOGIN_CONTINUE_PATH) return url.pathname
  if (AUTH_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) return null
  return url.pathname + url.search + url.hash
}

/** Cookie options for RETURN_TO_COOKIE (set server-side only). */
export function returnToCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: RETURN_TO_COOKIE_MAX_AGE,
  }
}

/** Callback error codes the login page knows how to explain. */
export type AuthErrorCode = 'oauth_cancelled' | 'oauth_failed' | 'link_expired'

/**
 * Map the error Supabase/Google append to the redirect (?error=,
 * ?error_code=, ?error_description=) to one of our codes. The raw
 * description is never echoed back to the page.
 */
export function authErrorCode(params: URLSearchParams): AuthErrorCode | null {
  const error = params.get('error')
  const code = params.get('error_code')
  if (!error && !code) return null
  if (code === 'otp_expired' || code === 'flow_state_expired' || code === 'flow_state_not_found') {
    return 'link_expired'
  }
  if (error === 'access_denied' && !code) return 'oauth_cancelled'
  if (error === 'access_denied' && /cancel|denied/i.test(params.get('error_description') ?? '')) {
    return 'oauth_cancelled'
  }
  return 'oauth_failed'
}
