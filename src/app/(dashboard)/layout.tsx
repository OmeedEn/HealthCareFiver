import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let role: 'contractor' | 'facility' | 'admin' = 'contractor'
  let displayName = 'User'
  let userEmail = ''

  if (isDemoMode()) {
    displayName = `${DEMO_CONTRACTOR.first_name} ${DEMO_CONTRACTOR.last_name}`
    userEmail = DEMO_CONTRACTOR.email
    role = 'contractor'
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
      <Sidebar role={role} userName={displayName} userEmail={userEmail} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={displayName} userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
