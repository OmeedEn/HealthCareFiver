import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/demo/data'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!isDemoMode()) {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:px-6">
          <h1 className="text-lg font-semibold text-[#404145]">HealthGig Admin</h1>
          <nav className="ml-8 flex items-center gap-4 text-sm">
            <a href="/admin" className="text-[#62646a] hover:text-[#1dbf73]">
              Dashboard
            </a>
            <a href="/admin/users" className="text-[#62646a] hover:text-[#1dbf73]">
              Users
            </a>
            <a href="/admin/credentials" className="text-[#62646a] hover:text-[#1dbf73]">
              Credentials
            </a>
            <a href="/admin/disputes" className="text-[#62646a] hover:text-[#1dbf73]">
              Disputes
            </a>
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  )
}
