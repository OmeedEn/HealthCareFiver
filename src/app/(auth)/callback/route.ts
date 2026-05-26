import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if this is a contractor who hasn't subscribed yet
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, subscription_status')
          .eq('id', user.id)
          .single()

        // Contractors need an active subscription to use the platform
        if (
          profile?.role === 'contractor' &&
          profile.subscription_status !== 'active'
        ) {
          return NextResponse.redirect(`${origin}/subscribe`)
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
