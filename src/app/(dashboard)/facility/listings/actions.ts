'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/demo/data'
import { ORG_AGREEMENT_VERSION } from '@/lib/legal'
import { blockedClaimsMessage, findBlockedClaims } from '@/lib/listings/claims'
import { checkFields, eventSchema, serviceSchema } from '@/app/onboarding/organization/shared'
import { draftToColumns, listingIsComplete, type ListingRow } from '@/app/onboarding/organization/listing-draft'

export type DraftResult = { ok: true; id: string | null } | { ok: false; error: string; fields?: Record<string, string> }

/**
 * Save the answers to one question of the "add a listing" flow. The first
 * save that includes a title creates the draft (the only required column);
 * later saves update it. Only drafts can be changed.
 */
export async function saveListingDraft(
  kind: 'service' | 'event',
  id: string | null,
  input: Record<string, unknown>,
  keys: string[]
): Promise<DraftResult> {
  if (kind !== 'service' && kind !== 'event') return { ok: false, error: 'Invalid listing.' }
  if (id !== null && !z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid listing.' }
  const shape = (kind === 'service' ? serviceSchema : eventSchema).shape
  const known = keys.filter((k): k is keyof typeof shape & string => k in shape)
  const fields = checkFields(shape, known, input ?? {})
  if (Object.keys(fields).length) return { ok: false, error: 'Please fix the highlighted fields.', fields }
  if ((known as string[]).includes('starts_at') && input.starts_at && Number.isNaN(Date.parse(String(input.starts_at)))) {
    return { ok: false, error: 'Please fix the highlighted fields.', fields: { starts_at: 'Enter a valid date and time' } }
  }

  const row = draftToColumns(kind, input, known)
  const claims = findBlockedClaims(String(row.title ?? ''), String(row.description ?? ''))
  if (claims.length) {
    const msg = blockedClaimsMessage(claims)
    return { ok: false, error: msg, fields: { description: msg } }
  }
  // Nothing to create yet (e.g. an event's type is asked before its title).
  if (!id && !row.title) return { ok: true, id: null }
  if (isDemoMode()) return { ok: true, id: id ?? crypto.randomUUID() }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' }

  const query = id
    ? supabase.from('org_listings').update(row).eq('id', id).eq('facility_id', user.id).eq('status', 'draft')
    : supabase.from('org_listings').insert({ ...row, kind, facility_id: user.id, status: 'draft' })
  const { data, error } = await query.select('id')
  if (error || !data?.length) {
    console.error('[facility/listings] saveListingDraft failed', error)
    return { ok: false, error: 'We couldn’t save that. Please try again.' }
  }
  return { ok: true, id: data[0].id as string }
}

/** Delete one of your own draft listings. */
export async function deleteOrgListing(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid listing.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' }
  const { error } = await supabase
    .from('org_listings')
    .delete()
    .eq('id', id)
    .eq('facility_id', user.id)
    .eq('status', 'draft')
  if (error) return { ok: false, error: 'We couldn’t delete that listing.' }
  refresh()
  return { ok: true }
}

/** Click-through organization agreement (approved orgs only; enforced by the RPC). */
export async function acceptOrgAgreement(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_org_agreement', { p_version: ORG_AGREEMENT_VERSION })
  if (error) {
    return {
      ok: false,
      error: error.hint === 'not_approved'
        ? 'You can accept the agreement once your organization is approved.'
        : 'We couldn’t save that. Please try again.',
    }
  }
  refresh()
  return { ok: true }
}

/** Draft → in review (needs approval + agreement; enforced by the DB). */
export async function submitOrgListing(id: string): Promise<{ ok: boolean; error?: string }> {
  return setListingStatus(id, 'in_review')
}

/** In review → back to draft. */
export async function withdrawOrgListing(id: string): Promise<{ ok: boolean; error?: string }> {
  return setListingStatus(id, 'draft')
}

async function setListingStatus(id: string, status: 'draft' | 'in_review') {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid listing.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' }
  if (status === 'in_review') {
    // Drafts now save question by question, so make sure it's finished.
    const { data: row } = await supabase
      .from('org_listings')
      .select('*')
      .eq('id', id)
      .eq('facility_id', user.id)
      .maybeSingle()
    if (!row) return { ok: false, error: 'Listing not found.' }
    if (!listingIsComplete(row as ListingRow)) {
      return { ok: false, error: 'Finish this listing first: open it with “Continue” and answer the remaining questions.' }
    }
  }
  const { data, error } = await supabase
    .from('org_listings')
    .update({ status })
    .eq('id', id)
    .eq('facility_id', user.id)
    .select('id')
  if (error) {
    return {
      ok: false,
      error: error.hint === 'agreement_required'
        ? 'Accept the organization agreement first.'
        : 'We couldn’t update that listing.',
    }
  }
  if (!data?.length) return { ok: false, error: 'Listing not found.' }
  refresh()
  return { ok: true }
}
