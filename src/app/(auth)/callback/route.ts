import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUnclaimedLoginAccount } from '@/lib/onboarding/google-account'
import { CLIENT_MATCHES_PATH } from '@/lib/find-care/match-shared'
import {
  RETURN_TO_COOKIE,
  authErrorCode,
  safeNextPath,
  type AuthErrorCode,
} from '@/lib/auth/safe-next'

// Default landings that a remembered destination (RETURN_TO_COOKIE, set by
// the proxy when someone opened /login or /signup with ?next=) may replace.
// Onboarding/account steps are never replaced: they must finish first.
const REPLACEABLE_LANDINGS = new Set(['/dashboard', CLIENT_MATCHES_PATH])

/**
 * Recoverable failure: back to /login with a reason the page explains, a
 * fresh "Continue with Google" button, and the intended destination kept as
 * ?redirectTo= so the retry lands where they were going. `signup` marks a
 * failure that started on /signup (the page then offers to restart sign-up
 * instead of the sign-in-only Google button).
 */
function recover(origin: string, reason: AuthErrorCode, next: string | null, signup: boolean) {
  const url = new URL('/login', origin)
  url.searchParams.set('error', reason)
  if (next) url.searchParams.set('redirectTo', next)
  if (signup) url.searchParams.set('from', 'signup')
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only same-origin relative paths (see src/lib/auth/safe-next.ts).
  const next = safeNextPath(searchParams.get('next'))
  const fromSignup = searchParams.get('intent') !== 'login'

  // Cancelled consent screen, provider error, or an expired/used email link.
  // Supabase appends error/error_code/error_description instead of a code.
  const providerError = authErrorCode(searchParams)
  if (providerError || !code) {
    if (providerError) {
      console.warn('Auth callback returned an error', {
        error: searchParams.get('error'),
        error_code: searchParams.get('error_code'),
      })
    }
    return recover(origin, providerError ?? 'oauth_failed', next, fromSignup)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Typically an expired/reused code or a PKCE verifier from another
    // browser. Never log the code itself.
    console.error('Auth code exchange failed:', { code: error.code, status: error.status })
    const expired = error.code === 'flow_state_expired' || error.code === 'flow_state_not_found' || error.code === 'otp_expired'
    return recover(origin, expired ? 'link_expired' : 'oauth_failed', next, fromSignup)
  }

  // Google on the sign-in page only signs in existing accounts. If this
  // sign-in just created one, undo it and send them to sign up.
  if (searchParams.get('intent') === 'login' && data.user) {
    const admin = createAdminClient()
    if (await isUnclaimedLoginAccount(admin, data.user)) {
      await supabase.auth.signOut()
      const { error: delError } = await admin.auth.admin.deleteUser(data.user.id)
      if (delError) console.error('Removing unclaimed Google account failed:', delError)
      return NextResponse.redirect(`${origin}/login?error=no_google_account`)
    }
  }

  // No subscription gate here: joining and verification are free. The
  // dashboard layout nudges verified professionals to subscribe to go live.
  // The proxy's MFA gate takes over from whatever page we land on.
  const landing = next ?? '/dashboard'
  const cookieStore = await cookies()
  const remembered = safeNextPath(cookieStore.get(RETURN_TO_COOKIE)?.value)
  const landingPath = landing.split(/[?#]/)[0]
  if (remembered && REPLACEABLE_LANDINGS.has(landingPath)) {
    cookieStore.delete(RETURN_TO_COOKIE)
    return NextResponse.redirect(`${origin}${remembered}`)
  }
  return NextResponse.redirect(`${origin}${landing}`)
}
