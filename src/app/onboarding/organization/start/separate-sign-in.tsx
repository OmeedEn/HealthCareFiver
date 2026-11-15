'use client'

import { useState } from 'react'
import { signOutAndRedirect } from '@/lib/auth/sign-out'

const START_OF: Record<string, string> = { PRACTICE: 'practice', COMPANY: 'company', HIRING: 'hiring' }

/**
 * Explicit opt-in to a separate organization account: signs out of this one
 * (nothing on it changes) and reopens the organization door of /signup.
 * Never automatic — a second identity is only created if the person
 * finishes that signup themselves.
 */
export function SeparateOrgSignIn({ source }: { source: string | null }) {
  const [busy, setBusy] = useState(false)
  const start = (source && START_OF[source]) || 'hiring'
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void signOutAndRedirect(`/signup?start=${start}`)
      }}
      className="mt-3 rounded text-sm font-semibold text-[#2f3cf5] hover:underline disabled:opacity-60"
    >
      Sign out and register a separate organization account
    </button>
  )
}
