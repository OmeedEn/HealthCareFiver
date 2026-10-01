'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mfaGate } from '@/lib/auth/mfa'
import { TERMS_VERSION } from '@/lib/legal'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { canConvertToOrg, convertToOrg } from '@/lib/onboarding/org-account'

export type OrgAccountState = { error?: string } | null

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`)

/**
 * Organization account step after "Continue with Google": turn the new
 * account into an organization (if it was created as a professional) and
 * collect name, title, phone and Terms consent. Then on to the wizard.
 */
export async function finishOrgAccount(
  _prev: OrgAccountState,
  formData: FormData
): Promise<OrgAccountState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/onboarding/organization/account')
  const gate = await mfaGate(supabase)
  if (gate !== 'ok') redirect(gate === 'enroll' ? '/mfa/enroll' : '/mfa/verify')

  const first = text('First name', 100).safeParse(formData.get('first_name') ?? '')
  if (!first.success) return { error: first.error.issues[0].message }
  const last = text('Last name', 100).safeParse(formData.get('last_name') ?? '')
  if (!last.success) return { error: last.error.issues[0].message }
  const title = text('Your role or title', 100).safeParse(formData.get('title') ?? '')
  if (!title.success) return { error: title.error.issues[0].message }
  const phone = normalizeUsPhone(String(formData.get('phone') ?? ''))
  if (!phone) return { error: `${PHONE_ERROR}.` }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const needsTerms = !meta.terms_accepted_at || !meta.terms_version
  if (needsTerms && formData.get('accepted_terms') !== 'on') {
    return { error: 'Please agree to the Terms of Service and Privacy Policy to continue.' }
  }
  if (needsTerms && formData.get('terms_version') !== TERMS_VERSION) {
    return { error: 'Our Terms were updated — please refresh the page and review them.' }
  }

  const admin = createAdminClient()
  const contactName = `${first.data} ${last.data}`
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role === 'contractor') {
    if (!(await canConvertToOrg(admin, user))) {
      return {
        error:
          'This Google account is already set up as a professional. Sign out and use a different account for your organization.',
      }
    }
    try {
      await convertToOrg(admin, user.id, contactName)
    } catch (err) {
      console.error('[onboarding/organization/account] convert failed', err)
      return { error: 'We couldn’t set up your organization account. Please try again.' }
    }
  } else if (profile?.role !== 'facility' && profile?.role !== 'staffing_agency') {
    redirect('/dashboard')
  }

  const [{ error: phoneError }, { error: orgError }, { error: metaError }] = await Promise.all([
    admin.from('profiles').update({ phone }).eq('id', user.id),
    admin
      .from('facility_profiles')
      .update({ contact_name: contactName, contact_title: title.data })
      .eq('id', user.id),
    supabase.auth.updateUser({
      data: {
        first_name: first.data,
        last_name: last.data,
        ...(needsTerms
          ? { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }
          : {}),
      },
    }),
  ])
  if (phoneError || orgError || metaError) {
    console.error('[onboarding/organization/account] save failed', phoneError ?? orgError ?? metaError)
    return { error: 'We couldn’t save your details. Please try again.' }
  }

  redirect('/onboarding/organization')
}
