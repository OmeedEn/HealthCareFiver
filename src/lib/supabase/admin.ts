import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getRequiredSupabaseConfig } from './config'

// TODO: Add <Database> generic once types are generated from `supabase gen types typescript`
export function createAdminClient() {
  const { url } = getRequiredSupabaseConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      'Supabase admin is not configured. Set SUPABASE_SERVICE_ROLE_KEY to use admin-only API routes.'
    )
  }

  return createSupabaseClient(url, serviceRoleKey)
}
