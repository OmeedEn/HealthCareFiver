import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { TERMS_VERSION } from '@/lib/legal'
import { computeGaps, hasGaps, namePrefill } from '@/lib/onboarding/account-gaps'
import { setSignupPathIfUnset } from '@/lib/onboarding/signup-path-server'
import { PRO_SIGNUP_COOKIE, parseProSignupCookie } from '@/lib/onboarding/professional-google'
import { applyProSignupAnswers } from '@/lib/onboarding/professional-answers'
import { FinishAccountForm } from './form'

export const metadata: Metadata = { title: 'Finish creating your account — Sanus' }

/**
 * Landing page after "Continue with Google" (via /callback). OAuth signups
 * skip the account screen, so collect whatever is still missing — Terms
 * consent, name — then hand off to /onboarding/professional. Users with
 * nothing missing pass straight through (their screens 1–3 answers from the
 * Google cookie are saved on the way).
 */
export default async function FinishAccountPage() {
  if (!getSupabaseConfig()) {
    // Demo mode: show the full form with nothing persisted.
    return (
      <Shell>
        <FinishAccountForm
          gaps={{ name: true, terms: true }}
          prefill={{ firstName: '', lastName: '' }}
          termsVersion={TERMS_VERSION}
        />
      </Shell>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/onboarding/account')

  const [{ data: profile }, { data: contractor }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('contractor_profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  // Only professionals onboard here (Google sign-up is only offered on
  // /signup/professional).
  if (profile?.role !== 'contractor') redirect('/dashboard')

  const gaps = computeGaps(user, contractor)
  if (!hasGaps(gaps)) {
    // Nothing to collect, so finishAccount won't run: record the door here.
    await setSignupPathIfUnset(createAdminClient(), user.id, 'INDEPENDENT')
    // The cookie expires on its own within the hour; applying is a no-op
    // once the profile has a category.
    const answers = parseProSignupCookie((await cookies()).get(PRO_SIGNUP_COOKIE)?.value)
    if (answers) await applyProSignupAnswers(supabase, user.id, answers)
    redirect('/onboarding/professional')
  }

  return (
    <Shell>
      <FinishAccountForm
        gaps={gaps}
        prefill={namePrefill(user, contractor)}
        termsVersion={TERMS_VERSION}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <header className="border-b border-[#e4e5e7] bg-white px-6 py-4">
        <Link href="/" className="flex w-fit items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1dbf73] text-base font-black text-white">
            S
          </div>
          <span className="text-xl font-black tracking-tight text-[#404145]">
            Sanus<span className="text-[#1dbf73]">.</span>
          </span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-10 sm:items-center">
        <div className="w-full max-w-md rounded-2xl border border-[#e4e5e7] bg-white p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
