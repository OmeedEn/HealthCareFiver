import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { isDemoMode, DEMO_CONTRACTOR, DEMO_FACILITY } from '@/lib/demo/data'

type DashboardRole = 'contractor' | 'facility' | 'admin'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let role: DashboardRole = 'contractor'
  let displayName = 'User'
  let userEmail = ''

  if (isDemoMode()) {
    // The DemoRoleSwitcher writes a `demo_role` cookie; the layout reads it
    // so the sidebar nav and header avatar match whatever dashboard the user
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
    } else if (role === 'admin') {
      displayName = 'HealthGig Admin'
      userEmail = 'admin@healthgig.com'
    } else {
      displayName = `${DEMO_CONTRACTOR.first_name} ${DEMO_CONTRACTOR.last_name}`
      userEmail = DEMO_CONTRACTOR.email
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
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    role = (profile?.role ?? user.user_metadata?.role ?? 'contractor') as
      | 'contractor'
      | 'facility'
      | 'admin'

    // Contractors must have an active subscription to access the dashboard
    if (role === 'contractor' && profile?.subscription_status !== 'active') {
      redirect('/subscribe')
    }

    displayName =
      profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : user.user_metadata?.first_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ''}`
          : user.email ?? 'User'

    userEmail = user.email ?? ''
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f7f7]">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#0f4c3a] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <Sidebar
        role={role}
        userName={displayName}
        userEmail={userEmail}
        variant="desktop"
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header role={role} userName={displayName} userEmail={userEmail} />
        <main
          id="dashboard-main"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 md:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
