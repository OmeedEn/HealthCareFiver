'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { mfaGate } from '@/lib/auth/mfa'
import { TERMS_VERSION } from '@/lib/legal'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { computeGaps } from '@/lib/onboarding/account-gaps'

export type FinishAccountState = { error?: string } | null

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be 100 characters or fewer`)

/**
 * Fill in what OAuth signups skip: phone, Terms/Privacy consent, and (if the
 * provider didn't give us one) a name. Only the gaps the server still sees
 * are written — a stale form can't overwrite existing values.
 */
export async function finishAccount(
  _prev: FinishAccountState,
  formData: FormData
): Promise<FinishAccountState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/onboarding/account')
  // Server actions POST to this page's path, so the proxy has already run
  // the MFA gate — check again anyway; never write from an AAL1 session.
  const gate = await mfaGate(supabase)
  if (gate !== 'ok') redirect(gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify')

  const [{ data: profile }, { data: contractor }] = await Promise.all([
    supabase.from('profiles').select('role, phone').eq('id', user.id).single(),
    supabase
      .from('contractor_profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle(),
  ])
  if (profile?.role !== 'contractor') redirect('/dashboard')

  const gaps = computeGaps(user, profile.phone, contractor)

  if (gaps.terms && formData.get('accepted_terms') !== 'on') {
    return { error: 'Please agree to the Terms of Service and Privacy Policy to continue.' }
  }
  if (gaps.terms && formData.get('terms_version') !== TERMS_VERSION) {
    return {
      error:
        'Our Terms of Service or Privacy Policy were updated — please refresh the page and review them.',
    }
  }

  let phone: string | null = null
  if (gaps.phone) {
    phone = normalizeUsPhone(String(formData.get('phone') ?? ''))
    if (!phone) return { error: `${PHONE_ERROR}.` }
  }

  let names: { first_name: string; last_name: string } | null = null
  if (gaps.name) {
    const first = name('First name').safeParse(formData.get('first_name') ?? '')
    if (!first.success) return { error: first.error.issues[0].message }
    const last = name('Last name').safeParse(formData.get('last_name') ?? '')
    if (!last.success) return { error: last.error.issues[0].message }
    names = { first_name: first.data, last_name: last.data }
  }

  if (phone) {
    const { error } = await supabase
      .from('profiles')
      .update({ phone })
      .eq('id', user.id)
    if (error) {
      console.error('[onboarding/account] phone update failed', error.code)
      return { error: 'We couldn’t save your phone number. Please try again.' }
    }
  }

  if (names) {
    const { error } = await supabase
      .from('contractor_profiles')
      .update(names)
      .eq('id', user.id)
    if (error) {
      console.error('[onboarding/account] name update failed', error.code)
      return { error: 'We couldn’t save your name. Please try again.' }
    }
  }

  if (gaps.terms || names) {
    // Consent record: server timestamp + the exact version shown, same keys
    // the email signup route writes.
    const { error } = await supabase.auth.updateUser({
      data: {
        ...(gaps.terms
          ? {
              terms_accepted_at: new Date().toISOString(),
              terms_version: TERMS_VERSION,
            }
          : {}),
        ...(names ?? {}),
      },
    })
    if (error) {
      console.error('[onboarding/account] metadata update failed', error.code)
      return { error: 'We couldn’t save your details. Please try again.' }
    }
  }

  redirect('/onboarding/professional')
}
