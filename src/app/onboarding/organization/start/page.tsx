import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { canConvertNewProfessional } from '@/lib/onboarding/google-account'
import { parseOrgSignupSource } from '@/lib/onboarding/org-signup-source'
import { SeparateOrgSignIn } from './separate-sign-in'

export const metadata: Metadata = { title: 'Add an organization — Sanus' }

/**
 * Organization entry for an account that already exists. A signed-in buyer
 * or professional choosing "organization" on /signup used to be bounced to
 * the homepage by the proxy (src/proxy.ts, signed-in /signup visitors). They
 * now land here. This page only reads; it never converts or edits the
 * account:
 *
 * - already an organization → its onboarding (which forwards to the
 *   dashboard once submitted);
 * - a brand-new, untouched professional account (the Google signup default)
 *   → the organization account step, which may safely convert it;
 * - anyone else (a buyer, or a professional with a draft or a finished
 *   profile) → this screen. Today one sign-in holds one account type
 *   (profiles.role) and an organization is the facility_profiles row with
 *   the same id, so an organization can't be attached to an existing
 *   personal account without a schema change (docs/auth-context-map.md).
 *   Their buyer profile / provider draft stays exactly as it was.
 */
export default async function OrgStartPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const source = parseOrgSignupSource((await searchParams).source)
  const self = source ? `/onboarding/organization/start?source=${source}` : '/onboarding/organization/start'

  if (!getSupabaseConfig()) return <OrgStartScreen context="buyer" back="/find-care" source={source} />

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(self)}`)

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? null

  if (role === 'facility' || role === 'staffing_agency') redirect('/onboarding/organization')
  if (role === 'admin') redirect('/admin')

  if (role === 'contractor') {
    if (await canConvertNewProfessional(admin, user)) {
      redirect(source ? `/onboarding/organization/account?source=${source}` : '/onboarding/organization/account')
    }
    const { data: pro } = await admin
      .from('contractor_profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle()
    const draft = !pro?.onboarding_completed_at
    return (
      <OrgStartScreen
        context={draft ? 'provider_draft' : 'provider'}
        back={draft ? '/onboarding/professional' : '/dashboard'}
        source={source}
      />
    )
  }

  return <OrgStartScreen context="buyer" back="/dashboard" source={source} />
}

type Context = 'buyer' | 'provider' | 'provider_draft'

const CONTEXT_COPY: Record<Context, { label: string; kept: string; back: string }> = {
  buyer: {
    label: 'Buying for myself',
    kept: 'Your personal account and its bookings, messages and preferences stay exactly as they are.',
    back: 'Back to my account',
  },
  provider: {
    label: 'Offering expertise',
    kept: 'Your professional profile stays exactly as it is.',
    back: 'Back to my dashboard',
  },
  provider_draft: {
    label: 'Offering expertise (profile not submitted)',
    kept: 'Your professional profile draft is saved and unchanged. Nothing here submits it.',
    back: 'Back to my profile draft',
  },
}

function OrgStartScreen({ context, back, source }: { context: Context; back: string; source: string | null }) {
  const copy = CONTEXT_COPY[context]
  return (
    <div className="mx-auto w-full max-w-xl rounded-xl border border-[#e3dfd6] bg-white p-6 sm:p-8">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#eceefe] text-[#2f3cf5]">
        <Building2 className="size-5" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-2xl font-black tracking-tight text-[#1a1a17]">Add an organization</h1>
      <p className="mt-1 text-sm text-[#5f5d57]">
        You&apos;re signed in. Current context:{' '}
        <span className="font-semibold text-[#1a1a17]">{copy.label}</span>
      </p>

      <div className="mt-6 space-y-3 text-sm text-[#1a1a17]">
        <p>
          Creating or joining an organization from an existing personal account isn&apos;t available yet. We
          haven&apos;t changed anything on your account.
        </p>
        <p className="text-[#5f5d57]">{copy.kept}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={back}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-[#2f3cf5] px-4 text-sm font-bold text-white hover:bg-[#2330c8]"
        >
          {copy.back}
        </Link>
        <Link
          href="/find-care"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-[#e3dfd6] px-4 text-sm font-semibold text-[#1a1a17] hover:bg-[#f6f4ef]"
        >
          Browse professionals
        </Link>
      </div>

      <div className="mt-8 border-t border-[#e3dfd6] pt-5 text-sm text-[#5f5d57]">
        <p className="font-semibold text-[#1a1a17]">Need the organization set up now?</p>
        <p className="mt-1">
          You can register it as its own account with a separate sign-in (for example, your work email). It
          won&apos;t be linked to this account, and you&apos;ll switch between them by signing in to each.
        </p>
        <SeparateOrgSignIn source={source} />
      </div>
    </div>
  )
}
