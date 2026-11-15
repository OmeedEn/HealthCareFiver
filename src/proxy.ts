import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { mfaGate } from '@/lib/auth/mfa'
import { ORG_LIGHT_COLUMNS, orgLightSetupDone, verifiesLater } from '@/lib/onboarding/org-verify-later'
import { parseOrgSignupSource } from '@/lib/onboarding/org-signup-source'
import {
  LOGIN_CONTINUE_PATH,
  RETURN_TO_COOKIE,
  authErrorCode,
  returnToCookieOptions,
  safeNextPath,
} from '@/lib/auth/safe-next'
import type { SupabaseClient } from '@supabase/supabase-js'

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/signup/contractor',
  '/signup/facility',
  '/forgot-password',
  '/callback',
  '/find-care',
  '/pros',
  '/orgs',
  '/events-and-training',
  '/for-organizations',
  '/for-professionals',
  '/how-it-works',
  '/terms',
  '/privacy',
  '/legal',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

// Where a professional who hasn't finished steps 2–5 is sent.
const PRO_ONBOARDING_PATH = '/onboarding/professional'
// Where an organization that hasn't submitted steps 2–4 is sent.
const ORG_ONBOARDING_PATH = '/onboarding/organization'
// Google sign-ups land as professionals; this step turns a brand-new account
// into an organization (src/app/onboarding/organization/account).
const ORG_ACCOUNT_PATH = '/onboarding/organization/account'
// Same for /signup/client: turns a brand-new account into a client
// (src/app/onboarding/client/account).
const CLIENT_ACCOUNT_PATH = '/onboarding/client/account'
// Same for /signup/unsure: turns a brand-new account into a Not sure (client,
// pending classification) account and asks the step 2 questions
// (src/app/onboarding/unsure).
const UNSURE_ACCOUNT_PATH = '/onboarding/unsure'
// Entry point for "organization" from an account that already exists (a
// buyer or a professional, finished or not). It decides server-side where
// they can go without touching their existing profile
// (src/app/onboarding/organization/start). Open to every signed-in role.
const ORG_START_PATH = '/onboarding/organization/start'

const ORG_ROLES = ['facility', 'staffing_agency']

/**
 * Same idea as contractorNeedsOnboarding, for organizations.
 * Verify later (src/lib/onboarding/org-verify-later.ts): a Hiring-door org
 * only needs type, name and city/state before the dashboard opens; it
 * verifies when it first posts, books or contacts a professional.
 */
async function orgNeedsOnboarding(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('facility_profiles')
    .select(`onboarding_submitted_at, ${ORG_LIGHT_COLUMNS}`)
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return false
  if (data.onboarding_submitted_at !== null) return false
  if (!orgLightSetupDone(data)) return true
  const { data: profile } = await supabase
    .from('profiles')
    .select('signup_path')
    .eq('id', userId)
    .maybeSingle()
  return !verifiesLater(profile?.signup_path)
}

/**
 * True only when we positively know this contractor hasn't finished the
 * onboarding wizard (onboarding_completed_at IS NULL). Any error — including
 * the column not existing yet on an older database — or a missing row means
 * "don't redirect", so a schema hiccup can never lock people out of the app.
 */
async function contractorNeedsOnboarding(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('contractor_profiles')
    .select('onboarding_completed_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return false
  return data.onboarding_completed_at === null
}

/**
 * What a signed-in visitor of /signup* asked for, from the door they picked
 * (`?start=`, or the old /signup/organization?source= URL). Only routing
 * hints: the destination pages re-check the account server-side.
 */
function signupIntent(
  request: NextRequest
): { kind: 'org'; source: string | null } | { kind: 'client' } | null {
  const { pathname, searchParams } = request.nextUrl
  if (underPrefix(pathname, '/signup/organization')) {
    return { kind: 'org', source: parseOrgSignupSource(searchParams.get('source')) }
  }
  if (underPrefix(pathname, '/signup/client')) return { kind: 'client' }
  const start = searchParams.get('start')
  if (start === 'practice' || start === 'company' || start === 'hiring') {
    return { kind: 'org', source: start.toUpperCase() }
  }
  if (start === 'client') return { kind: 'client' }
  return null
}

/** Copy refreshed Supabase session cookies onto a redirect so they aren't lost. */
function redirectKeepingSession(url: URL, supabaseResponse: NextResponse): NextResponse {
  const res = NextResponse.redirect(url)
  for (const c of supabaseResponse.cookies.getAll()) res.cookies.set(c)
  return res
}

/**
 * Where a signed-in user lands after logging in: an explicit, validated
 * destination (`next`) or one remembered in RETURN_TO_COOKIE when they
 * opened /login or /signup; otherwise the homepage, unless they still owe
 * MFA, haven't finished onboarding, or are an admin. /dashboard is reached
 * from the avatar menu → Account. A pending professional may still be sent
 * to a buyer page (e.g. /find-care): onboarding is only enforced on
 * /dashboard, never on browsing.
 */
async function landingUrl(
  request: NextRequest,
  supabase: SupabaseClient | null,
  userId: string,
  next: string | null = null
): Promise<{ url: URL; consumedReturnTo: boolean }> {
  const url = request.nextUrl.clone()
  url.search = ''
  url.pathname = '/'
  if (!supabase) return { url, consumedReturnTo: false }

  const gate = await mfaGate(supabase)
  if (gate !== 'ok') {
    url.pathname = gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify'
    // MFA comes back here, so the remembered destination still applies.
    url.searchParams.set('redirectTo', next ?? LOGIN_CONTINUE_PATH)
    return { url, consumedReturnTo: false }
  }

  const remembered = safeNextPath(request.cookies.get(RETURN_TO_COOKIE)?.value)
  const target = next ?? remembered
  if (target && target !== LOGIN_CONTINUE_PATH) {
    const dest = new URL(target, request.nextUrl.origin)
    // Belt and braces: safeNextPath already guarantees a same-origin path.
    if (dest.origin === request.nextUrl.origin) {
      return { url: dest, consumedReturnTo: !!remembered }
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  const role = profile?.role ?? ''
  if (role === 'contractor' && (await contractorNeedsOnboarding(supabase, userId))) {
    url.pathname = PRO_ONBOARDING_PATH
  } else if (ORG_ROLES.includes(role) && (await orgNeedsOnboarding(supabase, userId))) {
    url.pathname = ORG_ONBOARDING_PATH
  } else if (role === 'admin') {
    url.pathname = '/admin'
  }
  return { url, consumedReturnTo: false }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = isPublicRoute(pathname)

  // Demo mode (no Supabase configured): every page renders mocked data; let
  // the request through instead of bouncing to /login.
  if (!getSupabaseConfig()) {
    return NextResponse.next({ request })
  }

  const { supabase, user, supabaseResponse } = await updateSession(request)
  const redirect = (url: URL) => redirectKeepingSession(url, supabaseResponse)
  const isAuthEntry = pathname === '/login' || underPrefix(pathname, '/signup')
  // ?next= (signup links) or ?redirectTo= (login links), validated.
  const requestedNext =
    safeNextPath(request.nextUrl.searchParams.get('next')) ??
    safeNextPath(request.nextUrl.searchParams.get('redirectTo'))

  // If Supabase can't use the callback URL it falls back to the Site URL
  // (the homepage) with the error in the query. Show the recoverable login
  // state instead of a homepage that silently ignores the failure.
  if (pathname === '/' && !user) {
    const reason = authErrorCode(request.nextUrl.searchParams)
    if (reason) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('error', reason)
      return redirect(url)
    }
    // Same fallback on success: a PKCE code on the homepage still needs the
    // /callback exchange, otherwise the person looks signed out.
    const code = request.nextUrl.searchParams.get('code')
    if (code) {
      const url = request.nextUrl.clone()
      url.pathname = '/callback'
      url.search = ''
      url.searchParams.set('code', code)
      return redirect(url)
    }
  }

  // Allow public routes without auth
  if (isPublic) {
    // Signed-in visitors of /login or /signup, and the post-login hop
    // /login/continue, go to their landing page. A signup door that names a
    // capability goes there instead of the homepage: "organization" to the
    // organization entry (create/join), which never converts or edits their
    // existing account; "myself or my family" to buyer browsing. Otherwise
    // the validated ?next= / ?redirectTo= or remembered destination, else
    // the homepage — or the wizard for an account that hasn't finished
    // onboarding, /admin for admins. The homepage is public, so the MFA gate
    // is applied here first (the wizards and /admin are protected and gated
    // anyway).
    const isContinue = pathname === LOGIN_CONTINUE_PATH
    if (user && (isAuthEntry || isContinue)) {
      const intent = underPrefix(pathname, '/signup') ? signupIntent(request) : null
      const intentNext =
        intent?.kind === 'org'
          ? intent.source
            ? `${ORG_START_PATH}?source=${intent.source}`
            : ORG_START_PATH
          : intent?.kind === 'client'
            ? '/find-care'
            : null
      const { url, consumedReturnTo } = await landingUrl(
        request,
        supabase,
        user.id,
        intentNext ?? requestedNext
      )
      const res = redirect(url)
      if (consumedReturnTo) res.cookies.delete(RETURN_TO_COOKIE)
      return res
    }
    if (isContinue) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      return redirect(url)
    }
    // Anonymous visitor of /signup with a destination: remember it in a
    // short-lived httpOnly cookie so it survives the account questions, email
    // confirmation and the Google round trip (read back by /callback,
    // landingUrl, the signup API and the client account step). Path only,
    // already validated. /login doesn't need it: its ?redirectTo= rides
    // through the password sign-in and Google's /callback?next= directly.
    if (underPrefix(pathname, '/signup') && requestedNext) {
      supabaseResponse.cookies.set(
        RETURN_TO_COOKIE,
        requestedNext,
        returnToCookieOptions(request.nextUrl.protocol === 'https:')
      )
    }
    return supabaseResponse
  }

  // Protected routes: redirect to /login if no user. Keep the query string
  // (e.g. ?source=) so the destination is intact after signing in.
  if (!user || !supabase) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('redirectTo', pathname + request.nextUrl.search)
    return redirect(url)
  }

  // MFA gate: every session must be AAL2 before reaching any app page.
  // /mfa/* is where an AAL1 session enrolls or verifies.
  const gate = await mfaGate(supabase)
  const isMfaRoute = pathname === '/mfa' || pathname.startsWith('/mfa/')

  if (gate !== 'ok' && !isMfaRoute) {
    const url = request.nextUrl.clone()
    url.pathname = gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify'
    url.search = ''
    url.searchParams.set('redirectTo', pathname + request.nextUrl.search)
    return redirect(url)
  }

  if (isMfaRoute) {
    // Keep users on the step that matches their state.
    const target =
      gate === 'ok' ? '/dashboard' : gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify'
    if (pathname !== target) {
      const url = request.nextUrl.clone()
      url.pathname = target
      if (gate === 'ok') url.search = ''
      return redirect(url)
    }
    return supabaseResponse
  }

  // Fetch user role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // Role-based route gating
  if (pathname.startsWith('/contractor') && role !== 'contractor') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return redirect(url)
  }

  if (
    pathname.startsWith('/facility') &&
    role !== 'facility' &&
    role !== 'staffing_agency'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return redirect(url)
  }

  if (pathname.startsWith('/admin') && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return redirect(url)
  }

  // Organization onboarding is for organizations, plus the account step a
  // brand-new (Google) professional account uses to become one. The client
  // account step is for clients and brand-new professionals. Everything else
  // under /onboarding is professional onboarding, contractors only.
  // The organization entry (ORG_START_PATH) is open to every signed-in role:
  // it only reads, and routes each account to what it can do.
  const orgOnboardingAllowed =
    ORG_ROLES.includes(role ?? '') ||
    underPrefix(pathname, ORG_START_PATH) ||
    (role === 'contractor' && underPrefix(pathname, ORG_ACCOUNT_PATH))
  const clientAccountAllowed =
    (role === 'contractor' || role === 'client') &&
    (underPrefix(pathname, CLIENT_ACCOUNT_PATH) || underPrefix(pathname, UNSURE_ACCOUNT_PATH))
  if (
    underPrefix(pathname, ORG_ONBOARDING_PATH)
      ? !orgOnboardingAllowed
      : underPrefix(pathname, '/onboarding') && role !== 'contractor' && !clientAccountAllowed
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return redirect(url)
  }

  // Professional onboarding needs Terms consent first. Email signups give it
  // on the account screen; Google signups give it on the first screens of
  // /onboarding/professional itself (which also asks a brand-new Google
  // account that lost its signup path which path it meant, before treating
  // it as a professional). No separate hop here: /dashboard → onboarding →
  // consent page → onboarding used to bounce a new Google account around, and
  // the consent page could only ever make it a professional. The onboarding
  // actions check consent themselves.

  // Professionals who haven't finished the wizard land in it instead of the
  // dashboard. Only /dashboard is gated: /contractor/* pages (profile edit,
  // credentials) stay reachable because the wizard and pending screen link
  // to them. The extra query runs only for contractor /dashboard requests.
  if (
    role === 'contractor' &&
    underPrefix(pathname, '/dashboard') &&
    (await contractorNeedsOnboarding(supabase, user.id))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = PRO_ONBOARDING_PATH
    url.search = ''
    return redirect(url)
  }

  // Organizations that haven't submitted steps 2–4 land in their wizard.
  if (
    ORG_ROLES.includes(role ?? '') &&
    underPrefix(pathname, '/dashboard') &&
    (await orgNeedsOnboarding(supabase, user.id))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = ORG_ONBOARDING_PATH
    url.search = ''
    return redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
