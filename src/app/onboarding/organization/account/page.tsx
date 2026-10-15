import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { ORG_AGREEMENT_VERSION, TERMS_VERSION } from '@/lib/legal'
import { canConvertNewProfessional } from '@/lib/onboarding/google-account'
import { ORG_SIGNUP_SOURCE_COOKIE, parseOrgSignupSource } from '@/lib/onboarding/org-signup-source'
import { OrgAccountForm } from './form'

export const metadata: Metadata = { title: 'Finish creating your organization account — Sanus' }

/**
 * Landing page after "Continue with Google" on /signup/organization (via
 * /callback): the account screen's name and consent checkbox, then on to
 * screens 4–8 at /onboarding/organization.
 */
export default async function OrgAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // The signup door (PRACTICE / COMPANY / HIRING): from ?source= when it
  // survived the trip, else the cookie /signup/organization set.
  const source =
    parseOrgSignupSource((await searchParams).source) ??
    parseOrgSignupSource((await cookies()).get(ORG_SIGNUP_SOURCE_COOKIE)?.value)

  const form = (firstName: string, lastName: string) => (
    <OrgAccountForm
      prefill={{ firstName, lastName }}
      termsVersion={TERMS_VERSION}
      orgTermsVersion={ORG_AGREEMENT_VERSION}
      source={source}
    />
  )
  if (!getSupabaseConfig()) return form('', '')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/onboarding/organization/account')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>

  if (role === 'contractor') {
    // An established professional account can't be turned into an org.
    if (!(await canConvertNewProfessional(admin, user))) redirect('/dashboard')
  } else if (role === 'facility' || role === 'staffing_agency') {
    // Already an organization that agreed (email signup, or this step done): carry on.
    const { data: org } = await admin.from('facility_profiles').select('onboarding_submitted_at').eq('id', user.id).single()
    if ((meta.terms_accepted_at && meta.org_terms_accepted_at) || org?.onboarding_submitted_at) {
      redirect('/onboarding/organization')
    }
  } else {
    redirect('/dashboard')
  }

  const fullName = (meta.full_name || meta.name || '').trim()
  const [firstFromFull, ...rest] = fullName.split(/\s+/)
  return form(
    meta.first_name || meta.given_name || firstFromFull || '',
    meta.last_name || meta.family_name || rest.join(' ') || ''
  )
}
