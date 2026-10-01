import type { NextRequest } from 'next/server'

/**
 * Absolute URL that Supabase auth emails (signup confirmation, resend) link
 * back to. It must land on /callback so the PKCE code is exchanged for a
 * session before continuing to `next` (an internal path).
 *
 * Uses NEXT_PUBLIC_APP_URL (same as forgot-password / Stripe return URLs),
 * falling back to the request origin. Built server-side so a client can't
 * point the email link elsewhere. The hosted Supabase Auth "Redirect URLs"
 * allow-list must include `<app url>/callback**`.
 */
export function authCallbackUrl(
  request: NextRequest,
  next: `/${string}` = '/dashboard'
): string {
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  ).replace(/\/$/, '')
  return `${origin}/callback?next=${next}`
}
