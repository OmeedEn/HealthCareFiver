import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { countPendingClassification } from '@/lib/admin/classification'
import { countUnreadSupport } from '@/lib/admin/support'
import { AdminSignOutButton } from './sign-out-button'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let adminEmail = 'admin (demo)'
  const badges: Record<string, number> = {}
  if (!isDemoMode()) {
    const { admin, db } = await requireAdmin()
    adminEmail = admin.email ?? admin.id
    const [classification, verification, credentials, unreadMessages] = await Promise.all([
      countPendingClassification(db),
      db
        .from('contractor_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'pending_review'),
      db
        .from('credentials')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_review'),
      countUnreadSupport(db).catch(() => 0),
    ])
    badges['/admin/classification'] = classification
    badges['/admin/verification'] = verification.count ?? 0
    badges['/admin/credentials'] = credentials.count ?? 0
    badges['/admin/messages'] = unreadMessages
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-2 md:px-6">
          <Link href="/admin/verification" className="text-lg font-semibold text-[#404145]">
            Sanus Admin
          </Link>
          <AdminNav badges={badges} />
          <div className="ml-auto flex items-center gap-3 text-xs text-[#62646a]">
            <span>{adminEmail}</span>
            <Link href="/dashboard" className="hover:text-[#1dbf73]">
              Back to app
            </Link>
            <AdminSignOutButton />
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  )
}
