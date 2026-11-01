import type { SupabaseClient } from '@supabase/supabase-js'

type Name = { first_name: string; last_name: string }

/**
 * Names of the caller's conversation partners. client_profiles and non-live
 * contractor_profiles aren't readable by the other side, so the profile embed
 * falls back to "Unknown"; this RPC returns names only.
 */
export async function loadPartnerNames(
  supabase: SupabaseClient
): Promise<Map<string, Name>> {
  const out = new Map<string, Name>()
  const { data, error } = await supabase.rpc('conversation_partner_names')
  if (error || !Array.isArray(data)) return out
  for (const r of data as { id: string; first_name: string | null; last_name: string | null }[]) {
    if (r.first_name) out.set(r.id, { first_name: r.first_name, last_name: r.last_name ?? '' })
  }
  return out
}

/** Prefer the embedded name; use the RPC name when the embed was hidden. */
export function withPartnerName(
  id: string,
  name: Name,
  names: Map<string, Name>
): Name {
  if (name.first_name !== 'Unknown') return name
  return names.get(id) ?? name
}
