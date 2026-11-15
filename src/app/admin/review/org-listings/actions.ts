'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'
import { checkOrgListing } from '@/lib/eligibility/server'
import { reasonsMessage } from '@/lib/eligibility/rules'
import { ceuDetailsMissing } from '@/lib/listings/ce-credit'

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
    .select('*')
    .eq('id', id)
    .single()
  if (loadError || !listing) throw new Error('Listing not found')

  if (decision === 'publish') {
    // Shared eligibility rules: org approved + agreement, listing was
    // submitted (never straight from draft), no unsupported high-risk service.
    const check = await checkOrgListing(db, id, 'publish')
    if (check.outcome !== 'eligible') throw new Error(`Can’t publish: ${reasonsMessage(check.reasons)}`)
    // A credit claim can't go live without its details. Publishing does not
    // approve the claim: that's reviewOrgListingCredit.
    if (Object.keys(ceuDetailsMissing(listing.kind === 'event' ? listing.offers_ceu : null, listing)).length) {
      throw new Error('This event claims CE credit but is missing credit type, amount, accreditor or provider number.')
    }
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

/**
 * Separate review of an event's continuing-education credit claim.
 * Organization approval and listing publication never approve credit; only
 * this does, and only with every credit detail present.
 */
export async function reviewOrgListingCredit(id: string, decision: 'approve' | 'reject', formData: FormData) {
  const { admin, db } = await requireAdmin()
  if (!z.string().uuid().safeParse(id).success) throw new Error('Invalid listing')
  if (decision !== 'approve' && decision !== 'reject') throw new Error('Invalid decision')
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 4000)

  const { data: listing, error: loadError } = await db.from('org_listings').select('*').eq('id', id).single()
  if (loadError || !listing) throw new Error('Listing not found')
  if (listing.kind !== 'event' || listing.offers_ceu !== true) throw new Error('This listing doesn’t claim credit.')
  if (decision === 'approve' && Object.keys(ceuDetailsMissing(true, listing)).length) {
    throw new Error('Credit details are incomplete; request changes instead.')
  }

  const next = decision === 'approve' ? 'approved' : 'rejected'
  const { error } = await db
    .from('org_listings')
    .update({ ceu_claim_status: next, ceu_claim_reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Failed to update credit claim: ${error.message}`)

  await db.from('admin_audit_log').insert({
    admin_id: admin.id,
    action: `org_listing_credit_${decision}`,
    entity_type: 'org_listings',
    entity_id: id,
    old_value: { ceu_claim_status: listing.ceu_claim_status ?? null },
    new_value: { ceu_claim_status: next },
    notes: notes || null,
  })
  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: `org_listing_credit_${decision}`,
    targetTable: 'org_listings',
    targetId: id,
  })
  refresh()
}
