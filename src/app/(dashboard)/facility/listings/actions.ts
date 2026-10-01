'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

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
