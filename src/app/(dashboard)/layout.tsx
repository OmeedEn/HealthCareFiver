import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TopNav } from '@/components/layout/top-nav'
import { AccountTabs } from '@/components/layout/account-tabs'
import { toNavRole } from '@/components/layout/nav-config'
import type { SessionUser } from '@/components/layout/use-session-user'
import { PresenceHeartbeat } from '@/components/presence-heartbeat'
import { isDemoMode, DEMO_CONTRACTOR, DEMO_FACILITY } from '@/lib/demo/data'

type DashboardRole = 'contractor' | 'facility' | 'admin' | 'client'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let role: DashboardRole = 'contractor'
  let displayName = 'User'
  let userEmail = ''
  let userId: string | null = null
  let avatarUrl: string | null = null
  // Approved professionals who haven't accepted the contractor agreement yet
  // see a "go live" banner. Joining is free; the dashboard is never paywalled.
  let showGoLiveBanner = false

  if (isDemoMode()) {
    // The DemoRoleSwitcher writes a `demo_role` cookie; the layout reads it
    // so the account tabs and avatar menu match whatever dashboard the user
    // is previewing.
    const cookieStore = await cookies()
    const cookieRole = cookieStore.get('demo_role')?.value
    if (
      cookieRole === 'facility' ||
      cookieRole === 'admin' ||
      cookieRole === 'contractor'
    ) {
      role = cookieRole
    }

    if (role === 'facility') {
      displayName = DEMO_FACILITY.facility_name
      userEmail = DEMO_FACILITY.email
      userId = DEMO_FACILITY.id
    } else if (role === 'admin') {
      displayName = 'Sanus Admin'
      userEmail = 'admin@sanus.com'
    } else {
      displayName = `${DEMO_CONTRACTOR.first_name} ${DEMO_CONTRACTOR.last_name}`
      userEmail = DEMO_CONTRACTOR.email
      userId = DEMO_CONTRACTOR.id
    }
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      // my_profile(): own row incl. private columns (email, phone).
      .rpc('my_profile')
      .select('*')
      .maybeSingle<Record<string, string | boolean | null>>()

    role = (profile?.role ?? user.user_metadata?.role ?? 'contractor') as
      DashboardRole

    if (role === 'contractor') {
      // If the agreement column isn't available yet (migration not applied),
      // the select errors and we simply don't show the banner.
      const { data: contractor, error: contractorError } = await supabase
        .from('contractor_profiles')
        .select('verification_status, contractor_agreement_accepted_at')
        .eq('id', user.id)
        .maybeSingle()
      showGoLiveBanner =
        !contractorError &&
        (contractor?.verification_status === 'approved' ||
          contractor?.verification_status === 'insurance_pending') &&
        !contractor?.contractor_agreement_accepted_at
    }

    displayName =
      profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : user.user_metadata?.first_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ''}`
          : user.email ?? 'User'

    userEmail = user.email ?? ''
    userId = user.id
    avatarUrl = (user.user_metadata?.avatar_url as string | undefined) || null
  }

  const navRole = toNavRole(role)
  const navUser: SessionUser = {
    id: userId,
    name: displayName,
    email: userEmail,
    role: navRole,
    avatarUrl,
  }

  // No sidebar: the shared top nav (explore links + avatar menu) on top, then
  // the Account sub-nav for the "mine" side of the app.
  return (
    <div className="min-h-screen bg-[#f6f4ef]">
      <PresenceHeartbeat />
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#1a1a17] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <TopNav user={navUser} inApp />
      <AccountTabs role={navRole} />
      {showGoLiveBanner && (
        <div
          role="status"
          className="border-b border-[#2f3cf5]/30 bg-[#eceefe] text-sm text-[#1a1a17]"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="font-semibold">
              You&apos;re approved! Accept the contractor agreement to go live
            </p>
            <Link
              href="/go-live"
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#2f3cf5] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2330c8]"
            >
              Go live
            </Link>
          </div>
        </div>
      )}
      <main
        id="dashboard-main"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl px-4 py-4 outline-none sm:px-6 md:py-6"
      >
        {children}
      </main>
    </div>
  )
}
