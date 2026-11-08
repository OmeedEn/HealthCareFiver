import { NextResponse, type NextRequest } from 'next/server'

/**
 * Post-login landing hop. With Supabase configured the proxy (src/proxy.ts,
 * landingUrl) answers this path before it gets here — homepage, onboarding
 * wizard, MFA or /admin. This handler only runs in demo mode or if the proxy
 * lets the request through, and sends people to the homepage.
 */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/', request.url))
}
