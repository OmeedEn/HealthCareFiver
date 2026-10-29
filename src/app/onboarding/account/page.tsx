import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { TERMS_VERSION } from '@/lib/legal'
import { DEMO_CONTRACTOR } from '@/lib/demo/data'
import { computeGaps, hasGaps } from '@/lib/onboarding/account-gaps'
import { setSignupPathIfUnset } from '@/lib/onboarding/signup-path-server'
import { PRO_SIGNUP_COOKIE, parseProSignupCookie } from '@/lib/onboarding/professional-google'
import { applyProSignupAnswers } from '@/lib/onboarding/professional-answers'
import { EMPTY_PRO_ANSWERS } from '@/lib/onboarding/questions/professional'
import { ProfessionalOnboardingFlow } from '../professional/flow'

export const metadata: Metadata = { title: 'Finish creating your account — Sanus' }

/**
 * Landing page after "Continue with Google" on /signup/professional (via
 * /callback). The account screens Google skipped (Terms consent, a name if
 * Google didn't share one) are now the first screens of
 * /onboarding/professional, so this only hands off: users with nothing
 * missing get their signup door and Google-cookie answers saved on the way.
 */
export default async function FinishAccountPage() {
  if (!getSupabaseConfig()) {
    // Demo mode: the account screens followed by the application, nothing persisted.
    return (
      <ProfessionalOnboardingFlow
        userId={DEMO_CONTRACTOR.id}
        includeIdentity
        initialAnswers={EMPTY_PRO_ANSWERS}
        initialDocs={[]}
        initialDisclosures={{ picked: [], details: '', none: false }}
        progress={{ answered: [], skipped: [] }}
        account={{
          needsName: true,
          needsTerms: true,
          prefill: { firstName: '', lastName: '' },
          termsVersion: TERMS_VERSION,
          pickPath: false,
        }}
      />
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/onboarding/account')

  const [{ data: profile }, { data: contractor }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('contractor_profiles').select('first_name, last_name').eq('id', user.id).maybeSingle(),
  ])
  if (profile?.role !== 'contractor') redirect('/dashboard')

  if (!hasGaps(computeGaps(user, contractor))) {
    // Nothing to collect, so finishAccount won't run: record the door here.
    await setSignupPathIfUnset(createAdminClient(), user.id, 'INDEPENDENT')
    // The cookie expires on its own within the hour; applying is a no-op
    // once the profile has a category.
    const answers = parseProSignupCookie((await cookies()).get(PRO_SIGNUP_COOKIE)?.value)
    if (answers) await applyProSignupAnswers(supabase, user.id, answers)
  }
  redirect('/onboarding/professional')
}
