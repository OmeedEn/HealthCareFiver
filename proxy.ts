import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getSupabaseConfig } from '@/lib/supabase/config'

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/signup/contractor',
  '/signup/facility',
  '/forgot-password',
  '/callback',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = isPublicRoute(pathname)

  if (isPublic && !getSupabaseConfig()) {
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
