import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignupPath } from '@/lib/onboarding/signup-path'

/**
 * Record the signup door for an account that doesn't have one yet (Google
 * signups are created without it). signup_path is a protected column, so
 * this needs the service-role client. Never overwrites an existing door, and
 * never throws: a missing door must not block signup.
 */
export async function setSignupPathIfUnset(
  admin: SupabaseClient,
  userId: string,
  path: SignupPath
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ signup_path: path })
    .eq('id', userId)
    .is('signup_path', null)
  if (error) console.error('[signup-path] could not record signup_path', error.code)
}
