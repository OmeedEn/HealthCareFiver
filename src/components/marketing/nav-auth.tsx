'use client'

import { SignedInActions } from '@/components/layout/top-nav'
import { useSessionUser } from '@/components/layout/use-session-user'

export { profileHrefFor } from '@/components/layout/nav-config'

/**
 * Right side of a public page header. Signed out: renders `children` (the
 * page's own Sign in / Join buttons). Signed in: messages, notifications and
 * the avatar menu — or nothing, with `hideWhenSignedIn` (for secondary spots
 * where the account controls already show).
 */
export function NavAuth({
  children,
  hideWhenSignedIn = false,
}: {
  children: React.ReactNode
  hideWhenSignedIn?: boolean
}) {
  const state = useSessionUser()

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

  return <SignedInActions user={state} />
}
