import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:px-6">
          <h1 className="text-lg font-semibold">HealthGig Admin</h1>
          <nav className="ml-8 flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/admin/users" className="text-muted-foreground hover:text-foreground">
              Users
            </Link>
            <Link href="/admin/credentials" className="text-muted-foreground hover:text-foreground">
              Credentials
            </Link>
            <Link href="/admin/verification" className="text-muted-foreground hover:text-foreground">
              Verification
            </Link>
            <Link href="/admin/disputes" className="text-muted-foreground hover:text-foreground">
              Disputes
            </Link>
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  )
}
