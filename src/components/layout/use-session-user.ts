'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { toNavRole, type NavRole } from './nav-config'

export interface SessionUser {
  id: string | null
  name: string
  email: string
  role: NavRole
  avatarUrl: string | null
}

export type SessionState = 'loading' | 'out' | SessionUser

/**
 * The signed-in user for the top nav. Pages that already know the user
 * (the app layout) pass `initial` and no request is made; public pages load
 * it in the browser. Demo mode without `initial` counts as signed out.
 */
export function useSessionUser(initial?: SessionUser | null): SessionState {
  const [state, setState] = useState<SessionState>(
    initial ? initial : isDemoMode() ? 'out' : 'loading'
  )

  useEffect(() => {
    if (initial || isDemoMode()) return
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
          id: user.id,
          name,
          email: user.email ?? '',
          role: toNavRole(profile?.role ?? meta.role),
          avatarUrl: meta.avatar_url || null,
        })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [initial])

  // A server-provided user always wins (e.g. after the demo role switcher
  // refreshes the layout with a new role).
  return initial ?? state
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
