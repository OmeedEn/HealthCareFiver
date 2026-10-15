import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { TERMS_VERSION } from '@/lib/legal'
import { canConvertNewProfessional } from '@/lib/onboarding/google-account'
import { isPendingClassification } from '@/lib/onboarding/signup-path'
import { UNSURE_GOOGLE_ACCOUNT_PATH } from '@/lib/onboarding/unsure'
import { UnsureAccountForm } from './form'

export const metadata: Metadata = { title: 'Tell us about you — Sanus' }

/**
 * Landing page after "Continue with Google" on /signup/unsure (via
 * /callback). Google skips step 1's phone and Terms consent and step 2's
 * questions, so collect them here, then on to the dashboard.
 *
 * Only a brand-new Google account (created moments ago as a professional,
 * nothing started) or a pending Not sure account without answers on file
 * may use this page; everyone else goes to the dashboard.
 */
export default async function UnsureAccountPage() {
  if (!getSupabaseConfig()) {
    return (
      <Shell>
        <UnsureAccountForm prefill={{ firstName: '', lastName: '' }} needsTerms termsVersion={TERMS_VERSION} />
      </Shell>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=${UNSURE_GOOGLE_ACCOUNT_PATH}`)

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, signup_path, classification_status')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'contractor') {
    // An established professional account can't be turned into a Not sure account.
    if (!(await canConvertNewProfessional(admin, user))) redirect('/dashboard')
  } else if (profile?.role === 'client' && isPendingClassification(profile)) {
    const { data: existing } = await admin
      .from('classification_requests')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) redirect('/dashboard')
  } else {
    redirect('/dashboard')
  }

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>
  const fullName = (meta.full_name || meta.name || '').trim()
  const [firstFromFull, ...rest] = fullName.split(/\s+/)
  return (
    <Shell>
      <UnsureAccountForm
        prefill={{
          firstName: meta.first_name || meta.given_name || firstFromFull || '',
          lastName: meta.last_name || meta.family_name || rest.join(' ') || '',
        }}
        needsTerms={!meta.terms_accepted_at || !meta.terms_version}
        termsVersion={TERMS_VERSION}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#e4e5e7] bg-white p-6 sm:p-8">
      {children}
    </div>
  )
}
