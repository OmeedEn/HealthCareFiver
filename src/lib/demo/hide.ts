import 'server-only'

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Seeded demo accounts (scripts/demo-data.mjs) all use this email domain and
 * carry auth app_metadata.demo_seed = true. profiles.email mirrors the auth
 * email, so one profiles query finds them without per-user auth calls.
 */
export const DEMO_EMAIL_DOMAIN = 'demo.sanus.example'

/**
 * Hide seeded demo pros/orgs from discovery and profile pages.
 * HIDE_DEMO_DATA=true forces it on; on Vercel production it is on unless
 * HIDE_DEMO_DATA=false is set explicitly, so seeded sample accounts (with
 * seeded ratings) can never read as real production supply.
 */
export function hideDemoData(): boolean {
  const flag = process.env.HIDE_DEMO_DATA
  if (flag === 'true') return true
  if (flag === 'false') return false
  return process.env.VERCEL_ENV === 'production'
}

/**
 * Ids of seeded demo accounts, or an empty set when hiding is off.
 * Uses the service-role client (anon can't read profiles.email); without it
 * nothing can be identified, so nothing is hidden. Cached per request.
 */
export const getHiddenDemoIds = cache(async (): Promise<Set<string>> => {
  if (!hideDemoData() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Set()
  try {
    const { data, error } = await createAdminClient()
      .from('profiles')
      .select('id')
      .ilike('email', `%@${DEMO_EMAIL_DOMAIN}`)
    if (error) {
      console.error('[demo] demo account lookup failed', { code: error.code })
      return new Set()
    }
    return new Set((data ?? []).map((r) => r.id as string))
  } catch (err) {
    console.error('[demo] demo account lookup failed', err instanceof Error ? err.message : 'unknown')
    return new Set()
  }
})
