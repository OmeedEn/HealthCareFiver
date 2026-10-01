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
  signup: { label: 'Signup', className: 'bg-[#e8faf1] text-[#0f8f56]' },
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
        <h1 className="text-2xl font-bold text-[#404145]">Status updates</h1>
        <p className="mt-1 text-sm text-[#62646a]">
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
                ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                : 'border-[#e4e5e7] bg-white text-[#62646a] hover:border-[#1dbf73]'
            }`}
          >
            {k === 'all' ? 'All' : KIND_LABEL[k].label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="py-2">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#62646a]">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-[#f1f3f5]">
              {items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge className={KIND_LABEL[a.kind].className}>{KIND_LABEL[a.kind].label}</Badge>
                    {a.userId ? (
                      <Link href={`/admin/users/${a.userId}`} className="text-[#404145] hover:underline">
                        {a.text}
                      </Link>
                    ) : (
                      <span className="text-[#404145]">{a.text}</span>
                    )}
                  </div>
                  <span className="text-xs text-[#6b7280]" title={formatDateTime(a.at)}>
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
