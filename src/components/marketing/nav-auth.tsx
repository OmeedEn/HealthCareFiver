'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface SignedInUser {
  name: string
  avatarUrl: string | null
  profileHref: string
}

export function profileHrefFor(role: string | null | undefined): string {
  if (role === 'contractor') return '/contractor/profile'
  if (role === 'facility' || role === 'staffing_agency') return '/facility/profile'
  return '/settings'
}

/**
 * Right side of the public marketing nav. Signed out: renders `children`
 * (each page's own Sign in / Join buttons). Signed in: the user's avatar and
 * name, linking to their profile page — or nothing, with `hideWhenSignedIn`
 * (for secondary spots like a mobile menu where the avatar already shows).
 */
export function NavAuth({
  children,
  hideWhenSignedIn = false,
}: {
  children: React.ReactNode
  hideWhenSignedIn?: boolean
}) {
  const [state, setState] = useState<'loading' | 'out' | SignedInUser>(
    isDemoMode() ? 'out' : 'loading'
  )

  useEffect(() => {
    if (isDemoMode()) return
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setState('out')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const meta = user.user_metadata ?? {}
      const name =
        [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
        meta.full_name ||
        user.email ||
        'Account'

      if (!cancelled) {
        setState({
          name,
          avatarUrl: meta.avatar_url || null,
          profileHref: profileHrefFor(profile?.role ?? meta.role),
        })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'out') return <>{children}</>
  if (hideWhenSignedIn) return null

  // Hold the space while the session loads so the nav doesn't jump.
  if (state === 'loading') {
    return (
      <div aria-hidden className="invisible flex items-center gap-3">
        {children}
      </div>
    )
  }

  const initials = state.name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Link
      href={state.profileHref}
      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-[#f3f4f6]"
    >
      <Avatar>
        {state.avatarUrl && <AvatarImage src={state.avatarUrl} alt="" />}
        <AvatarFallback className="bg-[#e8faf1] text-xs font-semibold text-[#0f8f56]">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="hidden max-w-[10rem] truncate text-sm font-medium text-[#111827] sm:block">
        {state.name}
      </span>
    </Link>
  )
}
