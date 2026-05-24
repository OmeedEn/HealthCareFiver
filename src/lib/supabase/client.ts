import { createBrowserClient } from '@supabase/ssr'
import { getRequiredSupabaseConfig } from './config'

// TODO: Add <Database> generic once types are generated from `supabase gen types typescript`
export function createClient() {
  const { url, anonKey } = getRequiredSupabaseConfig()

  return createBrowserClient(url, anonKey)
}
