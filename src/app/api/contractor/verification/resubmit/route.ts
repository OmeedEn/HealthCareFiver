import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Called after a contractor uploads a new credential. If they were
 * previously asked for more information, flips their verification status
 * back to `pending_review` so the admin queue picks them up again.
 *
 * This can ONLY perform the more_info_requested -> pending_review
 * transition — it never grants approval. That keeps it safe to expose to
 * the contractor themself even though verification_status is otherwise
 * admin-only (see 20260808000001_add_provider_verification.sql).
 */
export async function POST() {
  const user = await currentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('contractor_profiles')
    .update({ verification_status: 'pending_review' })
    .eq('id', user.id)
    .eq('verification_status', 'more_info_requested')
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ resubmitted: !!data })
}
