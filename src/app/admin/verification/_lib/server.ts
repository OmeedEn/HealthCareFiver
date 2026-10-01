// Server-only: uses the service-role client. Never import from a client file.
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { currentUser, type SessionUser } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server Component guard for admin pages. The admin layout and proxy already
 * gate /admin, but data here is loaded with the service-role client, so we
 * re-check (incl. MFA via currentUser()) right before using it.
 */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')
  return user
}

export interface DuplicateFlag {
  kind: string
  other_contractor: string
  other_name?: string | null
}

type RpcCaller = (
  client: SupabaseClient,
  contractorId: string
) => PromiseLike<{ data: unknown; error: unknown }>

// provider_duplicate_flags(uuid) is admin-only. The parameter name isn't
// fixed by the contract; try the codebase's conventions in order.
const RPC_VARIANTS: RpcCaller[] = [
  (c, id) => c.rpc('provider_duplicate_flags', { p_contractor_id: id }),
  (c, id) => c.rpc('provider_duplicate_flags', { p_user_id: id }),
]

/**
 * Duplicate phone / payout-account flags per contractor. Calls the RPC as the
 * signed-in admin first (so an is_admin() check inside the function passes),
 * then falls back to the service role. Contractors whose lookup fails are
 * omitted from the map (callers show "unavailable").
 */
export async function fetchDuplicateFlags(
  contractorIds: string[]
): Promise<Map<string, DuplicateFlag[]>> {
  const out = new Map<string, DuplicateFlag[]>()
  if (contractorIds.length === 0) return out

  const clients: SupabaseClient[] = [await createClient(), createAdminClient()]

  // Find a client + signature that works using the first id.
  let working: { client: SupabaseClient; call: RpcCaller } | null = null
  for (const client of clients) {
    for (const call of RPC_VARIANTS) {
      const { data, error } = await call(client, contractorIds[0])
      if (!error) {
        working = { client, call }
        out.set(contractorIds[0], (data ?? []) as DuplicateFlag[])
        break
      }
    }
    if (working) break
  }
  if (!working) return out

  const rest = contractorIds.slice(1)
  const results = await Promise.all(
    rest.map((id) => working.call(working.client, id))
  )
  rest.forEach((id, i) => {
    if (!results[i].error) out.set(id, (results[i].data ?? []) as DuplicateFlag[])
  })
  return out
}
