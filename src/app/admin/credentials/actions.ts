'use server'

import { requireAdmin } from '@/lib/admin/guard'

/**
 * Email/phone for the providers in the review queue. profiles.email/phone
 * aren't readable from the browser (20261017000200_profiles_private_columns),
 * so this goes through the service role behind the admin check.
 */
export async function getCredentialContacts(
  ids: string[]
): Promise<Record<string, { email: string | null; phone: string | null }>> {
  const { db } = await requireAdmin()
  const clean = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500)
  if (!clean.length) return {}
  const { data } = await db.from('profiles').select('id, email, phone').in('id', clean)
  const out: Record<string, { email: string | null; phone: string | null }> = {}
  for (const p of data ?? []) {
    out[p.id as string] = { email: (p.email as string | null) ?? null, phone: (p.phone as string | null) ?? null }
  }
  return out
}
