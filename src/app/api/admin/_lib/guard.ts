import { NextResponse } from 'next/server'
import { currentUser, requireRole, type SessionUser } from '@/lib/auth/roles'

/**
 * Admin-only API guard. currentUser() enforces MFA (AAL2); requireRole()
 * enforces role. Only after this succeeds may a route use createAdminClient().
 */
export async function requireAdminApi(): Promise<
  { admin: SessionUser; error?: undefined } | { admin?: undefined; error: NextResponse }
> {
  const rawUser = await currentUser()
  try {
    return { admin: requireRole(rawUser, 'admin') }
  } catch {
    return {
      error: NextResponse.json(
        { error: rawUser ? 'Forbidden' : 'Unauthorized' },
        { status: rawUser ? 403 : 401 }
      ),
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
