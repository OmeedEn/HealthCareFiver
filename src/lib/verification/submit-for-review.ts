import { createAdminClient } from '@/lib/supabase/admin'

export type SubmitForReviewResult =
  | { ok: true; resubmitted: boolean }
  | { ok: false }

/**
 * Move a contractor into the admin verification queue (`pending_review`)
 * when they are either:
 *   - `not_submitted` — first submission since signing up, or
 *   - `more_info_requested` — responding to an admin's request.
 *
 * This can ONLY perform those two transitions to `pending_review` — it never
 * grants approval and never touches approved/rejected providers (the update
 * is conditional on the current status). That keeps it safe to run on behalf
 * of the contractor themself even though verification_status is otherwise
 * admin-only (see 20260808000001_add_provider_verification.sql and
 * 20260930000004_verification_not_submitted_default.sql).
 *
 * SERVER ONLY (service role). Callers MUST have already authenticated the
 * contractor via currentUser() (which enforces MFA) and pass THEIR OWN id.
 */
export async function submitContractorForReview(
  contractorId: string
): Promise<SubmitForReviewResult> {
  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('contractor_profiles')
    .update({ verification_status: 'pending_review' })
    .eq('id', contractorId)
    .in('verification_status', ['not_submitted', 'more_info_requested'])
    .select('id')
    .maybeSingle()

  if (error) return { ok: false }
  return { ok: true, resubmitted: !!data }
}
