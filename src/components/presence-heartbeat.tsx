'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'

const INTERVAL_MS = 60_000

/**
 * Tells the server "this user has the app open" about once a minute while
 * the tab is visible. Powers the admin inbox's online dot (user_presence,
 * supabase/migrations/20261030100100_presence_and_reply_state.sql).
 * Renders nothing; failures are ignored.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    if (isDemoMode()) return
    const supabase = createClient()
    const touch = () => {
      if (document.visibilityState !== 'visible') return
      supabase.rpc('touch_presence').then(
        () => {},
        () => {}
      )
    }
    touch()
    const id = setInterval(touch, INTERVAL_MS)
    document.addEventListener('visibilitychange', touch)
    window.addEventListener('focus', touch)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', touch)
      window.removeEventListener('focus', touch)
    }
  }, [])
  return null
}
