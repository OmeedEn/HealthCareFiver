import type { SupabaseClient } from '@supabase/supabase-js'

export type MfaGate = 'ok' | 'enroll' | 'verify'

/**
 * Every Sanus account handles PHI or admin data, so every session must reach
 * AAL2 (password + TOTP) before it can use the app. Once REQUIRE_MFA is on,
 * never add a per-user or per-route bypass.
 *
 * - 'enroll' — no verified TOTP factor yet
 * - 'verify' — factor exists but this session hasn't passed the challenge
 * - 'ok'     — session is AAL2
 *
 * Call only after `supabase.auth.getUser()` has validated the session; the
 * AAL claim is read from that same (now verified) JWT.
 *
 * Off until REQUIRE_MFA=true is set — enforcement is deferred for now. Turn it
 * on together with TOTP enrollment in the Supabase project's Auth settings.
 */
export async function mfaGate(supabase: SupabaseClient): Promise<MfaGate> {
  if (process.env.REQUIRE_MFA !== 'true') return 'ok'

  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  // Fail closed: if we can't determine the level, make them verify.
  if (error || !data) return 'verify'
  if (data.currentLevel === 'aal2') return 'ok'
  return data.nextLevel === 'aal2' ? 'verify' : 'enroll'
}
