import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { TERMS_VERSION } from '@/lib/legal'
import { canConvertToOrg } from '@/lib/onboarding/org-account'
import { OrgAccountForm } from './form'

export const metadata: Metadata = { title: 'Finish creating your organization account — Sanus' }

/**
 * Landing page after "Continue with Google" on /signup/organization (via
 * /callback). Google signups skip step 1's form, so collect name, title,
 * phone and Terms consent here, then hand off to the wizard.
 */
export default async function OrgAccountPage() {
  if (!getSupabaseConfig()) {
    return <OrgAccountForm prefill={{ firstName: '', lastName: '', title: '' }} needsTerms termsVersion={TERMS_VERSION} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/onboarding/organization/account')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, phone').eq('id', user.id).single()
  const role = profile?.role

  if (role === 'contractor') {
    // An established professional account can't be turned into an org.
    if (!(await canConvertToOrg(admin, user))) redirect('/dashboard')
  } else if (role === 'facility' || role === 'staffing_agency') {
    const { data: org } = await admin
      .from('facility_profiles')
      .select('contact_title')
      .eq('id', user.id)
      .single()
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const complete = org?.contact_title && profile?.phone && meta.terms_accepted_at && meta.terms_version
    if (complete) redirect('/onboarding/organization')
  } else {
    redirect('/dashboard')
  }

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>
  const fullName = (meta.full_name || meta.name || '').trim()
  const [firstFromFull, ...rest] = fullName.split(/\s+/)
  return (
    <OrgAccountForm
      prefill={{
        firstName: meta.first_name || meta.given_name || firstFromFull || '',
        lastName: meta.last_name || meta.family_name || rest.join(' ') || '',
        title: '',
      }}
      needsTerms={!meta.terms_accepted_at || !meta.terms_version}
      termsVersion={TERMS_VERSION}
    />
  )
}
