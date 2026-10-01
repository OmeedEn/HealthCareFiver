import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { mfaGate } from '@/lib/auth/mfa'
import { missingPhoneOrTerms } from '@/lib/onboarding/account-gaps'
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = isPublicRoute(pathname)

  // Demo mode (no Supabase configured): every page renders mocked data; let
  // the request through instead of bouncing to /login.
  if (!getSupabaseConfig()) {
    return NextResponse.next({ request })
  }

  const { supabase, user, supabaseResponse } = await updateSession(request)

  // Allow public routes without auth
  if (isPublic) {
    // If user is authenticated and visits /login or /signup, redirect to
    // /dashboard — or straight to the wizard for a professional who hasn't
    // finished onboarding (saves a hop through the /dashboard gate below).
    // Either target is protected, so the MFA gate still applies.
    if (user && (pathname === '/login' || pathname.startsWith('/signup'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      if (supabase) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (
          profile?.role === 'contractor' &&
          (await contractorNeedsOnboarding(supabase, user.id))
        ) {
          url.pathname = PRO_ONBOARDING_PATH
          url.search = ''
        }
      }
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Protected routes: redirect to /login if no user
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  if (!supabase) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // MFA gate: every session must be AAL2 before reaching any app page.
  // /mfa/* is where an AAL1 session enrolls or verifies.
  const gate = await mfaGate(supabase)
  const isMfaRoute = pathname === '/mfa' || pathname.startsWith('/mfa/')

  if (gate !== 'ok' && !isMfaRoute) {
    const url = request.nextUrl.clone()
    url.pathname = gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify'
    url.search = ''
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  if (isMfaRoute) {
    // Keep users on the step that matches their state.
    const target =
      gate === 'ok' ? '/dashboard' : gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify'
    if (pathname !== target) {
      const url = request.nextUrl.clone()
      url.pathname = target
      if (gate === 'ok') url.search = ''
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Fetch user role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, phone')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // Role-based route gating
  if (pathname.startsWith('/contractor') && role !== 'contractor') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (
    pathname.startsWith('/facility') &&
    role !== 'facility' &&
    role !== 'staffing_agency'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/admin') && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Professional onboarding (/onboarding/account, /onboarding/professional)
  // is for contractors only.
  if (underPrefix(pathname, '/onboarding') && role !== 'contractor') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // The wizard needs a phone number and Terms consent first. Email signups
  // provide both in step 1; Google signups provide them on
  // /onboarding/account, so send anyone missing them there. (Not applied to
  // /dashboard: existing professionals predate the phone requirement.)
  if (
    role === 'contractor' &&
    underPrefix(pathname, PRO_ONBOARDING_PATH) &&
    missingPhoneOrTerms(user, profile?.phone)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding/account'
    url.search = ''
    return NextResponse.redirect(url)
  }

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
    return NextResponse.redirect(url)
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
