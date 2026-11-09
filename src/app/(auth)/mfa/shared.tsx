'use client'

import { signOutAndRedirect } from '@/lib/auth/sign-out'
import { Separator } from '@/components/ui/separator'

// Only allow internal-path redirects to avoid an open redirect via `?redirectTo=`
export function safeRedirect(target: string | null): string {
  if (!target) return '/dashboard'
  if (!target.startsWith('/') || target.startsWith('//')) return '/dashboard'
  if (target.startsWith('/mfa')) return '/dashboard'
  return target
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
