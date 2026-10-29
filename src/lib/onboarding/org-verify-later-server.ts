import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * True when the user is an organization that hasn't submitted verification
 * (facility_profiles.onboarding_submitted_at IS NULL). Only Hiring
 * organizations reach the app in that state (see org-verify-later.ts); any
 * error or a missing row means "no", so this can never block a non-org.
 */
export async function orgMustVerify(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('facility_profiles')
    .select('onboarding_submitted_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return false
  return data.onboarding_submitted_at === null
}
