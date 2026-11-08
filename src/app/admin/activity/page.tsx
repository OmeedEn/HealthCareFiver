import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelativeTime } from '@/lib/utils/format'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { listAdminUsers, recentActivity, type ActivityItem } from '@/lib/admin/data'
import { AdminDemoNotice } from '@/components/admin/demo-notice'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<ActivityItem['kind'], { label: string; className: string }> = {
  signup: { label: 'Signup', className: 'bg-[#eceefe] text-[#2330c8]' },
  login: { label: 'Login', className: 'bg-blue-100 text-blue-800' },
  admin: { label: 'Admin', className: 'bg-purple-100 text-purple-800' },
  audit: { label: 'Activity', className: 'bg-gray-100 text-gray-700' },
  bug: { label: 'Bug', className: 'bg-red-100 text-red-700' },
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  if (isDemoMode()) return <AdminDemoNotice />

  const { kind = 'all' } = await searchParams
  const { db } = await requireAdmin()
  const users = await listAdminUsers(db)
  const all = await recentActivity(db, users, 200)
  const items = kind === 'all' ? all : all.filter((a) => a.kind === kind)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a17]">Status updates</h1>
        <p className="mt-1 text-sm text-[#5f5d57]">
          Everything happening on the platform: signups, logins, verification decisions, and bug reports.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'signup', 'login', 'admin', 'audit', 'bug'] as const).map((k) => (
          <Link
            key={k}
            href={k === 'all' ? '/admin/activity' : `/admin/activity?kind=${k}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              kind === k
                ? 'border-[#2f3cf5] bg-[#eceefe] text-[#2330c8]'
                : 'border-[#e3dfd6] bg-white text-[#5f5d57] hover:border-[#2f3cf5]'
            }`}
          >
            {k === 'all' ? 'All' : KIND_LABEL[k].label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="py-2">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#5f5d57]">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-[#eeebe4]">
              {items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge className={KIND_LABEL[a.kind].className}>{KIND_LABEL[a.kind].label}</Badge>
                    {a.userId ? (
                      <Link href={`/admin/users/${a.userId}`} className="text-[#1a1a17] hover:underline">
                        {a.text}
                      </Link>
                    ) : (
                      <span className="text-[#1a1a17]">{a.text}</span>
                    )}
                  </div>
                  <span className="text-xs text-[#5f5d57]" title={formatDateTime(a.at)}>
                    {formatRelativeTime(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
