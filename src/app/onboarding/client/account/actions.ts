'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mfaGate } from '@/lib/auth/mfa'
import { TERMS_VERSION } from '@/lib/legal'
import { canConvertNewProfessional, convertToClient } from '@/lib/onboarding/google-account'
import { CLIENT_SIGNUP_COOKIE, parseClientSignupCookie } from '@/lib/onboarding/client-google'
import { writeClientSignupAnswers } from '@/lib/onboarding/client-answers'
import { setSignupPathIfUnset } from '@/lib/onboarding/signup-path-server'
import { CLIENT_MATCHES_PATH } from '@/lib/find-care/match-shared'

export type ClientAccountState = { error?: string } | null

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`)

/**
 * Client account step after "Continue with Google": record Terms consent
 * and the 18+ attestation, turn the new account into a client (with the
 * signup answers from the cookie), then on to their matches.
 */
export async function finishClientAccount(
  _prev: ClientAccountState,
  formData: FormData
): Promise<ClientAccountState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/onboarding/client/account')
  const gate = await mfaGate(supabase)
  if (gate !== 'ok') redirect(gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify')

  const first = text('First name', 100).safeParse(formData.get('first_name') ?? '')
  if (!first.success) return { error: first.error.issues[0].message }
  const last = text('Last name', 100).safeParse(formData.get('last_name') ?? '')
  if (!last.success) return { error: last.error.issues[0].message }
  if (formData.get('adult_attested') !== 'on') {
    return { error: 'Please confirm you’re 18 or older.' }
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const needsTerms = !meta.terms_accepted_at || !meta.terms_version
  if (needsTerms && formData.get('accepted_terms') !== 'on') {
    return { error: 'Please agree to the Terms of Service and Privacy Policy to continue.' }
  }
  if (needsTerms && formData.get('terms_version') !== TERMS_VERSION) {
    return { error: 'Our Terms were updated — please refresh the page and review them.' }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'contractor' && profile?.role !== 'client') redirect('/dashboard')
  if (profile.role === 'contractor' && !(await canConvertNewProfessional(admin, user))) {
    return {
      error:
        'This Google account is already set up as a professional. Sign out and use a different account to look for care.',
    }
  }

  // Consent first: if the conversion below fails, a retry still works.
  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      first_name: first.data,
      last_name: last.data,
      ...(needsTerms ? { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION } : {}),
    },
  })
  if (metaError) {
    console.error('[onboarding/client/account] consent save failed', { code: metaError.code })
    return { error: 'We couldn’t save your details. Please try again.' }
  }

  const cookieStore = await cookies()
  const answers = parseClientSignupCookie(cookieStore.get(CLIENT_SIGNUP_COOKIE)?.value)

  if (profile.role === 'contractor') {
    try {
      await convertToClient(admin, user.id, {
        first_name: first.data,
        last_name: last.data,
        interests: answers.interests,
        city: answers.city,
        state: answers.state,
        zip_code: answers.zip_code,
        // Already validated by parseClientSignupCookie.
        help_timeline: answers.help_timeline,
        meeting_formats: answers.meeting_formats,
        adult_attested_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[onboarding/client/account] convert failed', err)
      return { error: 'We couldn’t set up your account. Please try again.' }
    }
  } else {
    const { error } = await admin
      .from('client_profiles')
      .update({ first_name: first.data, last_name: last.data })
      .eq('id', user.id)
    if (error) {
      console.error('[onboarding/client/account] name update failed', { code: error.code })
      return { error: 'We couldn’t save your details. Please try again.' }
    }
    // Validated + logged inside; never blocks the account.
    await writeClientSignupAnswers(admin, user.id, {
      help_timeline: answers.help_timeline,
      meeting_formats: answers.meeting_formats,
      adult_attested: true,
    })
  }

  await setSignupPathIfUnset(admin, user.id, 'CLIENT')
  cookieStore.delete(CLIENT_SIGNUP_COOKIE)
  redirect(answers.interests.length ? CLIENT_MATCHES_PATH : '/dashboard')
}
