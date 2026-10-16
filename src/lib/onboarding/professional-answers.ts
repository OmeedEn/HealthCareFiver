import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordProgress } from '@/lib/onboarding/progress'
import {
  PRO_Q,
  contractorColumnsFromAnswers,
  type ProAnswersParsed,
} from '@/lib/onboarding/questions/professional'

/**
 * Write screens 1–3 (answered before the account existed) to a brand-new
 * contractor profile, and mark them + the account screen answered so
 * /onboarding/professional resumes on screen 5. Never overwrites a profile
 * that already has a category (a stale cookie or a replayed request can't
 * change someone's answers). Returns false when nothing was written.
 *
 * `client` is the service-role client (email signup, right after
 * auth.signUp) or the person's own session client (Google account step).
 */
export async function applyProSignupAnswers(
  client: SupabaseClient,
  userId: string,
  answers: ProAnswersParsed
): Promise<boolean> {
  const { columns, answered } = contractorColumnsFromAnswers(answers)
  const { data, error } = await client
    .from('contractor_profiles')
    .update(columns)
    .eq('id', userId)
    .is('professional_category', null)
    .select('id')
    .maybeSingle()
  if (error) {
    // Code only: details can echo the row (the answers).
    console.error('[onboarding/professional] could not save signup answers', error.code)
    return false
  }
  if (!data) return false
  await recordProgress(client, userId, 'professional', { answered: [...answered, PRO_Q.account] })
  return true
}
