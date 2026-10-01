import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit/log'
import { isUuid, requireAdminApi } from '@/app/api/admin/_lib/guard'

type Action = 'publish' | 'request_changes' | 'pause'

const STATUS_BY_ACTION: Record<Action, 'published' | 'rejected' | 'paused'> = {
  publish: 'published',
  request_changes: 'rejected',
  pause: 'paused',
}

/**
 * Listing review decision. Publishing is gated in the database
 * (can_publish_offering via trigger); a refusal comes back as a 409 with the
 * database's reason so the admin sees exactly why.
 * Body: { action: 'publish' | 'request_changes' | 'pause', notes? }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ offeringId: string }> }
) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const admin = guard.admin

  const { offeringId } = await params
  if (!isUuid(offeringId)) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as Action
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : ''
  if (!(action in STATUS_BY_ACTION)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (action === 'request_changes' && !notes) {
    return NextResponse.json(
      { error: 'Tell the provider what to change' },
      { status: 400 }
    )
  }

  const adminSupabase = createAdminClient()
  const { data: offering } = await adminSupabase
    .from('professional_offerings')
    .select('id, contractor_id, title, status')
    .eq('id', offeringId)
    .maybeSingle()
  if (!offering) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const newStatus = STATUS_BY_ACTION[action]
  const now = new Date().toISOString()
  const { data: updated, error } = await adminSupabase
    .from('professional_offerings')
    .update({
      status: newStatus,
      review_notes: notes || null,
      reviewed_at: now,
      reviewed_by: admin.id,
    })
    .eq('id', offeringId)
    .select('id, status, review_notes, reviewed_at, reviewed_by')
    .single()

  if (error || !updated) {
    console.error('[admin/listings] update failed', error)
    const reason = error?.message ?? 'Update failed'
    return NextResponse.json(
      {
        error:
          action === 'publish'
            ? `Can’t publish this listing: ${reason}`
            : `Couldn’t update this listing: ${reason}`,
      },
      { status: action === 'publish' ? 409 : 500 }
    )
  }

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: `listing_${action}`,
    targetTable: 'professional_offerings',
    targetId: offeringId,
    metadata: { oldStatus: offering.status, newStatus, contractorId: offering.contractor_id },
  })

  const title =
    action === 'publish'
      ? 'Your listing is live'
      : action === 'request_changes'
        ? 'Changes needed on your listing'
        : 'Your listing was paused'
  const { error: notifyError } = await adminSupabase.from('notifications').insert({
    user_id: offering.contractor_id,
    type: `listing_${action}`,
    title,
    body: notes ? `“${offering.title}”: ${notes}` : `“${offering.title}”`,
    data: { href: '/contractor/listings' },
  })
  if (notifyError) console.error('[admin/listings] notification failed', notifyError)

  return NextResponse.json({ success: true, offering: updated })
}
