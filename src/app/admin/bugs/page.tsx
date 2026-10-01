import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelativeTime } from '@/lib/utils/format'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { BugStatusBadge, SeverityBadge } from '@/components/admin/status-badges'
import { updateBug } from './actions'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'active', label: 'Open & in progress', statuses: ['open', 'in_progress'] },
  { key: 'resolved', label: 'Resolved', statuses: ['resolved'] },
  { key: 'wont_fix', label: "Won't fix", statuses: ['wont_fix'] },
  { key: 'all', label: 'All', statuses: ['open', 'in_progress', 'resolved', 'wont_fix'] },
]

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export default async function AdminBugsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; id?: string }>
}) {
  if (isDemoMode()) return <AdminDemoNotice />

  const { tab = 'active', id: focusId } = await searchParams
  const { db } = await requireAdmin()
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0]

  const { data: bugs, error } = await db
    .from('bug_reports')
    .select('*')
    .in('status', activeTab.statuses)
    .order('created_at', { ascending: false })
    .limit(200)

  const reporterIds = [...new Set((bugs ?? []).map((b) => b.user_id).filter(Boolean))]
  const { data: reporters } = reporterIds.length
    ? await db.from('profiles').select('id, email, role').in('id', reporterIds)
    : { data: [] }
  const reporterById = new Map((reporters ?? []).map((r) => [r.id, r]))

  const sorted = [...(bugs ?? [])].sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
      b.created_at.localeCompare(a.created_at)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Bugs</h1>
        <p className="mt-1 text-sm text-[#62646a]">
          Reported by users from the &ldquo;Report a bug&rdquo; button, plus crashes captured automatically.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/bugs?tab=${t.key}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              t.key === activeTab.key
                ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                : 'border-[#e4e5e7] bg-white text-[#62646a] hover:border-[#1dbf73]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">
            Couldn&apos;t load bug reports: {error.message}. Has the 20261001000001_admin_console migration been applied?
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 && !error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[#62646a]">No bugs here.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((bug) => {
            const reporter = bug.user_id ? reporterById.get(bug.user_id) : null
            return (
              <Card key={bug.id} className={bug.id === focusId ? 'border-[#1dbf73]' : ''}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={bug.severity} />
                        <BugStatusBadge status={bug.status} />
                        {bug.source === 'auto' && <Badge variant="outline">auto-captured crash</Badge>}
                        <h2 className="font-semibold text-[#404145]">{bug.title}</h2>
                      </div>
                      <p className="mt-1 text-xs text-[#62646a]">
                        {reporter ? (
                          <Link href={`/admin/users/${bug.user_id}`} className="hover:underline">
                            {reporter.email} ({reporter.role})
                          </Link>
                        ) : (
                          'Unknown user'
                        )}{' '}
                        · {formatDateTime(bug.created_at)} ({formatRelativeTime(bug.created_at)})
                      </p>
                    </div>
                  </div>

                  {bug.description && (
                    <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-[#404145]">{bug.description}</p>
                  )}

                  <div className="grid gap-1 text-xs text-[#62646a] sm:grid-cols-2">
                    {bug.page_url && <p className="truncate">Page: {bug.page_url}</p>}
                    {bug.error_digest && <p>Error digest: <code>{bug.error_digest}</code></p>}
                    {bug.user_agent && <p className="truncate sm:col-span-2">Browser: {bug.user_agent}</p>}
                  </div>

                  <form action={updateBug.bind(null, bug.id)} className="flex flex-wrap items-center gap-2 border-t border-[#f1f3f5] pt-3">
                    <select
                      name="status"
                      defaultValue={bug.status}
                      className="h-9 rounded-md border border-[#e4e5e7] bg-white px-2 text-sm"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="wont_fix">Won&apos;t fix</option>
                    </select>
                    <input
                      name="admin_notes"
                      defaultValue={bug.admin_notes ?? ''}
                      placeholder="Internal notes / fix details"
                      className="h-9 min-w-48 flex-1 rounded-md border border-[#e4e5e7] px-3 text-sm outline-none focus:border-[#1dbf73]"
                    />
                    <button className="h-9 rounded-md bg-[#1dbf73] px-3 text-sm font-medium text-white hover:bg-[#19a463]">
                      Save
                    </button>
                  </form>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
