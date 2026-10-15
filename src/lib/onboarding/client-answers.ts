import 'server-only'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  HELP_TIMELINE_VALUES,
  MEETING_FORMAT_VALUES,
} from '@/lib/onboarding/client-interests'

// Client signup answers that handle_new_user doesn't copy (it only knows
// names, interests and location): written to client_profiles right after
// the account exists, by /api/auth/signup and the Google account step.
// Service-role client only; the caller has already checked the account.

const rowSchema = z.object({
  help_timeline: z.enum(HELP_TIMELINE_VALUES).nullable(),
  meeting_formats: z.array(z.enum(MEETING_FORMAT_VALUES)).max(4),
  adult_attested_at: z.iso.datetime().nullable(),
})

export type ClientSignupRow = z.infer<typeof rowSchema>

/**
 * Validates and writes the row. Never throws: the account already exists,
 * so a failure is logged (error code only — no answers) and the person can
 * fill these in later from the dashboard.
 */
export async function writeClientSignupAnswers(
  admin: SupabaseClient,
  userId: string,
  answers: { help_timeline?: string | null; meeting_formats?: readonly string[]; adult_attested: boolean }
): Promise<boolean> {
  const parsed = rowSchema.safeParse({
    help_timeline: answers.help_timeline ?? null,
    meeting_formats: Array.from(new Set(answers.meeting_formats ?? [])),
    adult_attested_at: answers.adult_attested ? new Date().toISOString() : null,
  })
  if (!parsed.success) {
    console.error('[client-signup] answers failed validation', { code: 'invalid_answers' })
    return false
  }
  // Only what was answered: never blank out answers already on file.
  const row: Partial<ClientSignupRow> = {}
  if (parsed.data.help_timeline) row.help_timeline = parsed.data.help_timeline
  if (parsed.data.meeting_formats.length) row.meeting_formats = parsed.data.meeting_formats
  if (parsed.data.adult_attested_at) row.adult_attested_at = parsed.data.adult_attested_at
  if (!Object.keys(row).length) return true
  const { error } = await admin.from('client_profiles').update(row).eq('id', userId)
  if (error) {
    console.error('[client-signup] answers save failed', { code: error.code })
    return false
  }
  return true
}
