'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mfaGate } from '@/lib/auth/mfa'
import { ORG_AGREEMENT_VERSION, TERMS_VERSION } from '@/lib/legal'
import { canConvertNewProfessional, convertToOrg } from '@/lib/onboarding/google-account'
import { ORG_TYPE_KEYS, facilityTypeEnumFor, orgTypesForPath, type OrgTypeKey } from '@/lib/onboarding/organization'
import {
  ORG_SIGNUP_ANSWERS_COOKIE,
  ORG_SIGNUP_SOURCE_COOKIE,
  parseOrgSignupAnswers,
  parseOrgSignupSource,
} from '@/lib/onboarding/org-signup-source'
import { setSignupPathIfUnset } from '@/lib/onboarding/signup-path-server'

export type OrgAccountState = { error?: string } | null

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`)

/**
 * Organization account screen after "Continue with Google": turn the new
 * account into an organization (if it was created as a professional), save
 * screens 1–2 carried in the cookie, and record the one consent checkbox
 * (Terms of Service, Privacy Policy, Organization Terms). No title or
 * phone: those are dashboard items now. Then on to screens 4–8.
 */
export async function finishOrgAccount(_prev: OrgAccountState, formData: FormData): Promise<OrgAccountState> {
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

  if (formData.get('accepted_terms') !== 'on') {
    return { error: 'Please agree to the Terms of Service, Privacy Policy, and Organization Terms to continue.' }
  }
  if (formData.get('terms_version') !== TERMS_VERSION || formData.get('org_terms_version') !== ORG_AGREEMENT_VERSION) {
    return { error: 'Our Terms were updated — please refresh the page and review them.' }
  }

  const admin = createAdminClient()
  const contactName = `${first.data} ${last.data}`
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role === 'contractor') {
    if (!(await canConvertNewProfessional(admin, user))) {
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

  // The door they came through (Google accounts are created without one).
  // Validated against the org doors; if it was lost, leave it unset.
  const cookieStore = await cookies()
  const source =
    parseOrgSignupSource(formData.get('source')) ??
    parseOrgSignupSource(cookieStore.get(ORG_SIGNUP_SOURCE_COOKIE)?.value)
  if (source) await setSignupPathIfUnset(admin, user.id, source)

  // Screens 1–2 from before the Google round trip. Re-validated here; if
  // anything's off, /onboarding/organization asks them again.
  const orgUpdate: Record<string, unknown> = { contact_name: contactName }
  const answers = parseOrgSignupAnswers(cookieStore.get(ORG_SIGNUP_ANSWERS_COOKIE)?.value)
  const { data: org } = await admin.from('facility_profiles').select('org_type, facility_name').eq('id', user.id).single()
  if (answers && source) {
    const type = answers.org_type as OrgTypeKey
    const typeOk =
      (ORG_TYPE_KEYS as readonly string[]).includes(type) &&
      orgTypesForPath(source).some((t) => t.value === type) &&
      (type !== 'other' || !!answers.org_type_other)
    if (typeOk && !org?.org_type) {
      orgUpdate.org_type = type
      orgUpdate.facility_type = facilityTypeEnumFor(type)
      orgUpdate.org_type_other = type === 'other' ? answers.org_type_other : null
    }
    if (answers.facility_name && !org?.facility_name) orgUpdate.facility_name = answers.facility_name
  }

  const now = new Date().toISOString()
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const [{ error: orgError }, { error: metaError }] = await Promise.all([
    admin.from('facility_profiles').update(orgUpdate).eq('id', user.id),
    supabase.auth.updateUser({
      data: {
        first_name: first.data,
        last_name: last.data,
        ...(!meta.terms_accepted_at || meta.terms_version !== TERMS_VERSION
          ? { terms_accepted_at: now, terms_version: TERMS_VERSION }
          : {}),
        org_terms_accepted_at: now,
        org_terms_version: ORG_AGREEMENT_VERSION,
      },
    }),
  ])
  if (orgError || metaError) {
    console.error('[onboarding/organization/account] save failed', orgError ?? metaError)
    return { error: 'We couldn’t save your details. Please try again.' }
  }

  cookieStore.delete(ORG_SIGNUP_SOURCE_COOKIE)
  cookieStore.delete(ORG_SIGNUP_ANSWERS_COOKIE)
  redirect('/onboarding/organization')
}
