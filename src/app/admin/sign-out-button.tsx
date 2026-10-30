'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { signOutAndRedirect } from '@/lib/auth/sign-out'
import { isDemoMode } from '@/lib/demo/data'

/** Sign out from the admin header. */
export function AdminSignOutButton() {
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    if (isDemoMode()) {
      window.location.assign('/login')
      return
    }
    await signOutAndRedirect('/login')
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="inline-flex items-center gap-1 font-medium hover:text-[#1dbf73] disabled:opacity-50"
    >
      <LogOut className="size-3.5" aria-hidden="true" />
      {busy ? 'Signing out…' : 'Log out'}
    </button>
  )
}
