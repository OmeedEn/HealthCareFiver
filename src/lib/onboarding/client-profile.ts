import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeClientInterests } from '@/lib/onboarding/client-interests'

// A client's saved answers (client_profiles), read with the caller's RLS
// client. The Single-Question columns come from migration
// 20261016000400_client_single_question.sql; until it's applied the read
// falls back to the original columns so pages still render.

export interface ClientProfile {
  first_name: string | null
  interests: string[]
  city: string | null
  state: string | null
  zip_code: string | null
  help_timeline: string | null
  meeting_formats: string[]
  goals: string | null
  language: string | null
  budget: string | null
  note: string | null
}

const BASE = 'first_name, interests, city, state, zip_code'
const FULL = `${BASE}, help_timeline, meeting_formats, goals, language, budget, note`

export async function loadClientProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ClientProfile | null> {
  let { data, error } = await supabase.from('client_profiles').select(FULL).eq('id', userId).maybeSingle()
  if (error) {
    ;({ data, error } = await supabase.from('client_profiles').select(BASE).eq('id', userId).maybeSingle())
  }
  if (error || !data) return null
  const r = data as Record<string, unknown>
  const s = (v: unknown) => (typeof v === 'string' && v.length ? v : null)
  return {
    first_name: s(r.first_name),
    interests: normalizeClientInterests(Array.isArray(r.interests) ? (r.interests as string[]) : []),
    city: s(r.city),
    state: s(r.state),
    zip_code: s(r.zip_code),
    help_timeline: s(r.help_timeline),
    meeting_formats: Array.isArray(r.meeting_formats) ? (r.meeting_formats as string[]) : [],
    goals: s(r.goals),
    language: s(r.language),
    budget: s(r.budget),
    note: s(r.note),
  }
}
