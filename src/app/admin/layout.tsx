import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/verification', label: 'Verification' },
  { href: '/admin/credentials', label: 'Credentials' },
  { href: '/admin/activity', label: 'Activity' },
  { href: '/admin/bugs', label: 'Bugs' },
  { href: '/admin/disputes', label: 'Disputes' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let adminEmail = 'admin (demo)'
  if (!isDemoMode()) {
    const { admin } = await requireAdmin()
    adminEmail = admin.email ?? admin.id
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-2 md:px-6">
          <Link href="/admin" className="text-lg font-semibold text-[#404145]">
            Sanus Admin
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[#62646a] hover:text-[#1dbf73]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-[#62646a]">
            <span>{adminEmail}</span>
            <Link href="/dashboard" className="hover:text-[#1dbf73]">
              Back to app
            </Link>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  )
}
