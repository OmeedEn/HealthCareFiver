import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { TERMS_VERSION } from '@/lib/legal'
import { canConvertNewProfessional } from '@/lib/onboarding/google-account'
import { ClientAccountForm } from './form'

export const metadata: Metadata = { title: 'Finish creating your account — Sanus' }

/**
 * Landing page after "Continue with Google" on /signup/client (via
 * /callback). Turns the brand-new account into a client with step 1's
 * answers and collects Terms consent, then on to the dashboard.
 */
export default async function ClientAccountPage() {
  if (!getSupabaseConfig()) {
    return <ClientAccountForm prefill={{ firstName: '', lastName: '' }} needsTerms termsVersion={TERMS_VERSION} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/onboarding/client/account')

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>
  const needsTerms = !meta.terms_accepted_at || !meta.terms_version

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role === 'contractor') {
    // An established professional account can't be turned into a client.
    if (!(await canConvertNewProfessional(admin, user))) redirect('/dashboard')
  } else if (profile?.role !== 'client' || !needsTerms) {
    // Existing client (Google linked to their account) or another role.
    redirect('/dashboard')
  }

  const fullName = (meta.full_name || meta.name || '').trim()
  const [firstFromFull, ...rest] = fullName.split(/\s+/)
  return (
    <ClientAccountForm
      prefill={{
        firstName: meta.first_name || meta.given_name || firstFromFull || '',
        lastName: meta.last_name || meta.family_name || rest.join(' ') || '',
      }}
      needsTerms={needsTerms}
      termsVersion={TERMS_VERSION}
    />
  )
}
