'use server'

import { refresh } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { intentsSchema } from '@/app/onboarding/organization/shared'

/** Organizations can change what they want to do on Sanus at any time. */
export async function updateOrgIntents(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = intentsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' }

  const { error } = await supabase
    .from('facility_profiles')
    .update({ intents: Array.from(new Set(parsed.data)) })
    .eq('id', user.id)
  if (error) return { ok: false, error: 'We couldn’t save that. Please try again.' }
  refresh()
  return { ok: true }
}
