import 'server-only'
import { redirect } from 'next/navigation'
import { currentUser, type SessionUser } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Gate for admin Server Components and Server Actions. The proxy already
 * blocks non-admins by pathname, but Server Actions are reachable by POST from
 * anywhere, so every admin read/write re-checks here before touching the
 * service-role client.
 */
export async function requireAdmin(): Promise<{
  admin: SessionUser
  db: ReturnType<typeof createAdminClient>
}> {
  const user = await currentUser()
  if (!user) redirect('/login?redirectTo=/admin')
  if (user.role !== 'admin') redirect('/dashboard')
  return { admin: user, db: createAdminClient() }
}
