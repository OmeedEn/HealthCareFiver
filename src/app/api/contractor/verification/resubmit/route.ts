import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Called after a contractor uploads a credential. Moves them into the admin
 * verification queue (`pending_review`) when they are either:
 *   - `not_submitted` — first upload since signing up, or
 *   - `more_info_requested` — responding to an admin's request.
 *
 * This can ONLY perform those two transitions to `pending_review` — it never
 * grants approval and never touches approved/rejected providers (the update
 * is conditional on the current status). That keeps it safe to expose to the
 * contractor themself even though verification_status is otherwise admin-only
 * (see 20260808000001_add_provider_verification.sql and
 * 20260930000004_verification_not_submitted_default.sql).
 */
export async function POST() {
  const user = await currentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== 'contractor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('contractor_profiles')
    .update({ verification_status: 'pending_review' })
    .eq('id', user.id)
    .in('verification_status', ['not_submitted', 'more_info_requested'])
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ resubmitted: !!data })
}
