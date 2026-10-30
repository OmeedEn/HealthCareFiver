import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUnclaimedLoginAccount } from '@/lib/onboarding/google-account'

// Only allow internal-path redirects to avoid an open redirect via `?next=`
// (e.g. /onboarding/account after Google sign-in). Backslashes are rejected
// too: browsers treat `/\evil.com` like `//evil.com`.
function safeNext(target: string | null): string | null {
  if (!target) return null
  if (!target.startsWith('/') || target.startsWith('//')) return null
  if (target.includes('\\')) return null
  return target
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Auth code exchange failed:', error)
    return NextResponse.redirect(`${origin}/login`)
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
  return NextResponse.redirect(`${origin}${next ?? '/dashboard'}`)
}
