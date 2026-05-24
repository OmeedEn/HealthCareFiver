import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
    .eq('user_id', user.id)
    .single()

  const role = (profile?.role ?? user.user_metadata?.role ?? 'contractor') as
    | 'contractor'
    | 'facility'
    | 'admin'

  const displayName =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : user.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ''}`
        : user.email ?? 'User'

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f7f7]">
      <Sidebar role={role} userName={displayName} userEmail={user.email ?? ''} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={displayName} userEmail={user.email ?? ''} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
