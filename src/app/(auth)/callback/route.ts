import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only allow internal-path redirects to avoid an open redirect via `?next=`
function safeNext(target: string | null): string | null {
  if (!target) return null
  if (!target.startsWith('/') || target.startsWith('//')) return null
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
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Auth code exchange failed:', error)
    return NextResponse.redirect(`${origin}/login`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // The handle_new_user trigger inserts the profile row; that runs in the same
  // transaction as auth.users insert so it must be visible here, but treat a
  // missing row as a soft failure rather than a 500.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, subscription_status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Profile lookup after auth failed:', profileError)
  }

  // Contractors need an active subscription to use the platform
  if (
    profile?.role === 'contractor' &&
    profile.subscription_status !== 'active'
  ) {
    return NextResponse.redirect(`${origin}/subscribe`)
  }

  return NextResponse.redirect(`${origin}${next ?? '/dashboard'}`)
}
