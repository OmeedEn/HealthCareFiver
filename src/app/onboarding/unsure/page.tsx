import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { TERMS_VERSION } from '@/lib/legal'
import { canConvertNewProfessional } from '@/lib/onboarding/google-account'
import { isPendingClassification } from '@/lib/onboarding/signup-path'
import {
  UNSURE_GOOGLE_ACCOUNT_PATH,
  UNSURE_SIGNUP_COOKIE,
  parseUnsureSignupCookie,
} from '@/lib/onboarding/unsure'
import { UnsureFinishFlow } from './form'

export const metadata: Metadata = { title: 'Finish creating your account — Sanus' }

/**
 * Landing page after "Continue with Google" on /signup/unsure (via
 * /callback). The answers to screens 1–4 arrive in the hand-off cookie, so
 * this only asks for what Google skipped: the Terms consent and the review
 * authorization (plus a name if Google didn't share one). If the cookie is
 * missing or invalid, the four questions are asked again first.
 *
 * Only a brand-new Google account (created moments ago as a professional,
 * nothing started) or a pending Not sure account without answers on file
 * may use this page; everyone else goes to the dashboard.
 */
export default async function UnsureAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const fromPicker = (await searchParams).from === 'pick'
  const answers = parseUnsureSignupCookie((await cookies()).get(UNSURE_SIGNUP_COOKIE)?.value)

  if (!getSupabaseConfig()) {
    return (
      <UnsureFinishFlow
        answers={answers}
        prefill={{ firstName: '', lastName: '' }}
        needsTerms
        termsVersion={TERMS_VERSION}
        fromPicker={fromPicker}
      />
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
    <UnsureFinishFlow
      answers={answers}
      prefill={{
        firstName: (meta.first_name || meta.given_name || firstFromFull || '').trim(),
        lastName: (meta.last_name || meta.family_name || rest.join(' ') || '').trim(),
      }}
      needsTerms={!meta.terms_accepted_at || !meta.terms_version}
      termsVersion={TERMS_VERSION}
      fromPicker={fromPicker}
    />
  )
}
