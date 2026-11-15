'use client'

import { signOutAndRedirect } from '@/lib/auth/sign-out'
import { Separator } from '@/components/ui/separator'
import { safeNextPath } from '@/lib/auth/safe-next'

// Only same-origin relative paths (src/lib/auth/safe-next.ts; /mfa and other
// auth pages are refused) to avoid an open redirect via `?redirectTo=`.
export function safeRedirect(target: string | null): string {
  return safeNextPath(target) ?? '/dashboard'
}

export function MfaSignOut() {
  async function handleSignOut() {
    await signOutAndRedirect('/login')
  }

  return (
    <>
      <Separator className="my-6" />
      <p className="text-center text-sm text-[#5f5d57]">
        Not you?{' '}
        <button
          type="button"
          onClick={handleSignOut}
          className="font-bold text-[#2f3cf5] hover:underline"
        >
          Sign out
        </button>
      </p>
    </>
  )
}
