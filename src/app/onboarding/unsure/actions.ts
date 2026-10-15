'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mfaGate } from '@/lib/auth/mfa'
import { TERMS_VERSION } from '@/lib/legal'
import { canConvertNewProfessional } from '@/lib/onboarding/google-account'
import { isPendingClassification } from '@/lib/onboarding/signup-path'
import {
  UNSURE_GOOGLE_ACCOUNT_PATH,
  UNSURE_REVIEW_CONSENT_ERROR,
  UNSURE_SIGNUP_COOKIE,
  classificationRequestRow,
  unsureAnswersSchema,
} from '@/lib/onboarding/unsure'

export type FinishUnsureResult = { ok: true } | { ok: false; error: string }

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)

const inputSchema = z.object({
  first_name: text('First name', 100),
  last_name: text('Last name', 100),
  accepted_terms: z.boolean().optional(),
  terms_version: z.string().optional(),
  review_consent: z.literal(true, { error: UNSURE_REVIEW_CONSENT_ERROR }),
  answers: unsureAnswersSchema,
})

/**
 * Not sure signup after "Continue with Google": record the two consents
 * Google skipped (Terms + Privacy, and the review authorization), turn the
 * brand-new account (created as a professional by default) into a client
 * with signup_path UNSURE and classification_status pending, and file the
 * answers for staff review. The answers come from the hand-off cookie (or,
 * if it was lost, the screens /onboarding/unsure re-asked).
 *
 * Returns a result instead of redirecting so the flow can record the
 * completed-signup analytics event before navigating to /dashboard.
 */
export async function finishUnsureAccount(input: unknown): Promise<FinishUnsureResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=${UNSURE_GOOGLE_ACCOUNT_PATH}`)
  const gate = await mfaGate(supabase)
  if (gate !== 'ok') redirect(gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify')

  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Please complete all required fields.' }
  }
  const body = parsed.data

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const needsTerms = !meta.terms_accepted_at || !meta.terms_version
  if (needsTerms && body.accepted_terms !== true) {
    return { ok: false, error: 'Please agree to the Terms of Service and Privacy Policy to continue.' }
  }
  if (needsTerms && body.terms_version !== TERMS_VERSION) {
    return { ok: false, error: 'Our Terms were updated — please refresh the page and review them.' }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, signup_path, classification_status')
    .eq('id', user.id)
    .single()

  const isNewProfessional = profile?.role === 'contractor'
  // A retry after a partly failed conversion lands here as a pending client.
  const isPendingClient = profile?.role === 'client' && isPendingClassification(profile)
  if (!isNewProfessional && !isPendingClient) redirect('/dashboard')
  if (isNewProfessional && !(await canConvertNewProfessional(admin, user))) {
    return {
      ok: false,
      error: 'This Google account is already set up as a professional. Sign out and use a different account.',
    }
  }

  // Consent first: if the conversion below fails, a retry still works.
  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      first_name: body.first_name,
      last_name: body.last_name,
      ...(needsTerms ? { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION } : {}),
    },
  })
  if (metaError) {
    console.error('[onboarding/unsure] consent save failed', metaError.message)
    return { ok: false, error: 'We couldn’t save your details. Please try again.' }
  }

  try {
    if (isNewProfessional) {
      const { error: delError } = await admin.from('contractor_profiles').delete().eq('id', user.id)
      if (delError) throw new Error(`remove professional profile: ${delError.message}`)
    }

    // Protected columns (role, signup_path, classification_status): service role only.
    const { error: profileError } = await admin
      .from('profiles')
      .update({ role: 'client', signup_path: 'UNSURE', classification_status: 'pending' })
      .eq('id', user.id)
    if (profileError) throw new Error(`update profile: ${profileError.message}`)

    const { error: clientError } = await admin
      .from('client_profiles')
      .upsert({ id: user.id, first_name: body.first_name, last_name: body.last_name }, { onConflict: 'id' })
    if (clientError) throw new Error(`client profile: ${clientError.message}`)
  } catch (err) {
    console.error('[onboarding/unsure] convert failed', err instanceof Error ? err.message : err)
    return { ok: false, error: 'We couldn’t set up your account. Please try again.' }
  }

  const { error: requestError } = await admin
    .from('classification_requests')
    .insert(classificationRequestRow(user.id, body.answers, new Date().toISOString()))
  // 23505: answers already on file (double submit) — nothing left to do.
  if (requestError && requestError.code !== '23505') {
    console.error('[onboarding/unsure] classification_requests insert failed', requestError.code, requestError.message)
    return { ok: false, error: 'We couldn’t save your answers. Please try again.' }
  }

  ;(await cookies()).delete(UNSURE_SIGNUP_COOKIE)
  return { ok: true }
}
