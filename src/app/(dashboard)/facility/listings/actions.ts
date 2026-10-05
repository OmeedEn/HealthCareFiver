'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ORG_AGREEMENT_VERSION } from '@/lib/legal'

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
