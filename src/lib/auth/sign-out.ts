'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Sign out and do a full page load to `to`.
 *
 * A client-side router.push isn't enough: Next's router cache can still hold
 * pages (and the /login → /dashboard redirect) fetched while signed in, so the
 * user would appear to stay logged in. A hard navigation drops that cache and
 * makes the proxy re-check the now-cleared session cookies.
 */
export async function signOutAndRedirect(to = '/login') {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    // Server revoke failed (e.g. network) — still drop the local session so the
    // user is signed out on this device.
    await supabase.auth.signOut({ scope: 'local' })
  }
  window.location.assign(to)
}
