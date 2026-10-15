'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { loadClientProfile } from '@/lib/onboarding/client-profile'
import { CLIENT_NOTE_MAX } from '@/lib/onboarding/client-interests'

export type CareRequestResult = { ok: true; already?: boolean } | { ok: false; error: string }

const noteSchema = z
  .string()
  .trim()
  .max(CLIENT_NOTE_MAX, `Keep it to ${CLIENT_NOTE_MAX} characters.`)

/**
 * "Request help finding someone" (results screen, fewer than 3 matches).
 * What they need is already on their profile, so this files a snapshot of
 * those answers plus an optional short note for staff
 * (/admin/care-requests). One open request per person.
 */
export async function requestCareHelp(note: string): Promise<CareRequestResult> {
  const parsed = noteSchema.safeParse(note ?? '')
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }

  const profile = await loadClientProfile(supabase, user.id)
  if (!profile) return { ok: false, error: 'Only client accounts can request help.' }

  const { error } = await supabase.from('care_requests').insert({
    user_id: user.id,
    interests: profile.interests,
    timeline: profile.help_timeline,
    formats: profile.meeting_formats,
    zip: profile.zip_code,
    note: parsed.data || null,
  })
  if (error) {
    // Unique open request per person: they already asked.
    if (error.code === '23505') return { ok: true, already: true }
    console.error('[care-requests] insert failed', { code: error.code })
    return { ok: false, error: 'We couldn’t send your request. Please try again.' }
  }
  return { ok: true }
}
