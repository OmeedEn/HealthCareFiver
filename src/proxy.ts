import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { mfaGate } from '@/lib/auth/mfa'

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/signup/contractor',
  '/signup/facility',
  '/forgot-password',
  '/callback',
  '/find-care',
  '/terms',
  '/privacy',
  '/legal',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
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
    // If user is authenticated and visits /login or /signup, redirect to /dashboard
    if (user && (pathname === '/login' || pathname.startsWith('/signup'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
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
    .select('role')
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
