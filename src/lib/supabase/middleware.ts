import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseConfig } from './config'

// TODO: Add <Database> generic once types are generated from `supabase gen types typescript`
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const config = getSupabaseConfig()

  if (!config) {
    return { supabase: null, user: null, supabaseResponse }
  }

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data } = await supabase.auth.getUser().catch(() => ({
    data: { user: null },
  }))

  return { supabase, user: data.user, supabaseResponse }
}
