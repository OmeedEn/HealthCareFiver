'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
import { canGoLive } from '@/lib/auth/can-go-live'

const applySchema = z.object({
  jobId: z.string().uuid(),
  coverLetter: z.string().max(10000).nullable(),
  proposedRate: z.number().nonnegative().finite().nullable(),
  availableStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
})

export type ApplyToJobInput = z.input<typeof applySchema>

export type ApplyToJobResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'unauthorized'
        | 'invalid'
        | 'not_verified'
        | 'not_subscribed'
        | 'duplicate'
        | 'error'
      message: string
    }

/**
 * Apply to a job. Only professionals who can "go live" (verified AND an
 * active/trialing subscription) may apply.
 */
export async function applyToJob(
  input: ApplyToJobInput
): Promise<ApplyToJobResult> {
  // currentUser() enforces AAL2 (MFA).
  const user = await currentUser()
  if (!user || user.role !== 'contractor') {
    return {
      ok: false,
      reason: 'unauthorized',
      message: 'You must be signed in as a professional to apply.',
    }
  }

  const parsed = applySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'Please check your application details and try again.',
    }
  }

  const supabase = await createClient()

  const live = await canGoLive(supabase, user.id)
  if (!live.ok) {
    return { ok: false, reason: live.reason, message: live.message }
  }

  const { jobId, coverLetter, proposedRate, availableStartDate } = parsed.data
  const { error } = await supabase.from('job_applications').insert({
    job_id: jobId,
    contractor_id: user.id,
    status: 'applied',
    cover_letter: coverLetter || null,
    proposed_rate: proposedRate,
    available_start_date: availableStartDate,
  })

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate',
        message: 'You have already applied to this job.',
      }
    }
    console.error('Job application insert failed:', error)
    return {
      ok: false,
      reason: 'error',
      message: 'Failed to submit application. Please try again.',
    }
  }

  return { ok: true }
}
