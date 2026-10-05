'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'

type Decision = 'publish' | 'request_changes' | 'unpublish'

const NEXT: Record<Decision, string> = { publish: 'published', request_changes: 'draft', unpublish: 'draft' }

/** Admin review of an organization's service or event. */
export async function reviewOrgListing(id: string, decision: Decision, formData: FormData) {
  const { admin, db } = await requireAdmin()
  if (!z.string().uuid().safeParse(id).success) throw new Error('Invalid listing')
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 4000)
  if (decision !== 'publish' && !notes) throw new Error('Add a note for the organization.')

  const { data: listing, error: loadError } = await db
    .from('org_listings')
    .select('id, facility_id, title, status')
    .eq('id', id)
    .single()
  if (loadError || !listing) throw new Error('Listing not found')

  if (decision === 'publish') {
    const { data: ok } = await db.rpc('org_can_publish', { p_org_id: listing.facility_id })
    if (!ok) throw new Error('This organization isn’t approved or hasn’t accepted the agreement.')
  }

  const { error } = await db
    .from('org_listings')
    .update({ status: NEXT[decision], review_notes: decision === 'publish' ? null : notes, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Failed to update listing: ${error.message}`)

  await db.from('admin_audit_log').insert({
    admin_id: admin.id,
    action: `org_listing_${decision}`,
    entity_type: 'org_listings',
    entity_id: id,
    old_value: { status: listing.status },
    new_value: { status: NEXT[decision] },
    notes: notes || null,
  })
  await audit({ actorId: admin.id, actorRole: 'admin', action: `org_listing_${decision}`, targetTable: 'org_listings', targetId: id })

  const message = {
    publish: { type: 'listing_publish', title: `“${listing.title}” is live`, body: 'Your listing passed review and is now published.' },
    request_changes: { type: 'listing_request_changes', title: `Changes requested on “${listing.title}”`, body: notes },
    unpublish: { type: 'listing_pause', title: `“${listing.title}” was unpublished`, body: notes },
  }[decision]
  const { error: nErr } = await db.from('notifications').insert({
    user_id: listing.facility_id, type: message.type, title: message.title, body: message.body, data: { href: '/facility/listings' },
  })
  if (nErr) console.error('[admin/org-listings] notification failed', nErr)

  refresh()
}
