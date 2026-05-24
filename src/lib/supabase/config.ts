export type SupabaseConfig = {
  url: string
  anonKey: string
}

const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321'
const DEFAULT_SUPABASE_ANON_KEY = 'anon-key'

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY

  return { url, anonKey }
}

export function getRequiredSupabaseConfig(): SupabaseConfig {
  const config = getSupabaseConfig()

  if (!config) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use auth and data features.'
    )
  }

  return config
}
