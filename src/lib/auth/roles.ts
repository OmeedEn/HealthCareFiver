import { createClient } from '@/lib/supabase/server'

export type Role = 'contractor' | 'facility' | 'staffing_agency' | 'admin'

export interface SessionUser {
  id: string
  email: string | null
  role: Role
}

/**
 * Resolve the current session user with their role. Returns null if not
 * authenticated, or if Supabase is not configured (demo mode).
 *
 * Throws if the user is authenticated but has no profile row — that is a data
 * integrity violation (handle_new_user should always create one).
 */
export async function currentUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error(
      `User ${user.id} has no profile row — data integrity violation.`
    )
  }

  return {
    id: user.id,
    email: user.email ?? null,
    role: profile.role as Role,
  }
}

/**
 * Throw if `user` is not authenticated or not in `allowed`. Use inside Server
 * Components / API routes that need a stronger guarantee than the proxy-level
 * route gate (which only checks pathname prefixes).
 */
export function requireRole(
  user: SessionUser | null,
  ...allowed: Role[]
): SessionUser {
  if (!user) {
    throw new Error('Unauthenticated')
  }
  if (!allowed.includes(user.role)) {
    throw new Error(
      `Role ${user.role} not authorized — required: ${allowed.join(', ')}`
    )
  }
  return user
}
