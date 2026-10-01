import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth/roles'
import { submitContractorForReview } from '@/lib/verification/submit-for-review'

/**
 * Called after a contractor uploads a credential. Moves them into the admin
 * verification queue (`pending_review`) when they are `not_submitted` or
 * `more_info_requested`. See submitContractorForReview() for the (narrow)
 * transitions this can perform.
 */
export async function POST() {
  const user = await currentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== 'contractor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await submitContractorForReview(user.id)

  if (!result.ok) {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ resubmitted: result.resubmitted })
}
