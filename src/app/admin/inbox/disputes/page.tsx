import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelativeTime } from '@/lib/utils/format'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { OPEN_DISPUTE_STATUSES } from '@/lib/admin/queue-counts'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { updateDispute } from './actions'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-red-100 text-red-700' },
  under_review: { label: 'Under review', className: 'bg-blue-100 text-blue-800' },
  escalated: { label: 'Escalated', className: 'bg-amber-100 text-amber-800' },
  resolved_contractor: { label: 'Resolved for professional', className: 'bg-[#e8faf1] text-[#0f8f56]' },
  resolved_facility: { label: 'Resolved for organization', className: 'bg-[#e8faf1] text-[#0f8f56]' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700' },
}

const TABS = [
  { key: 'open', label: 'Open', statuses: [...OPEN_DISPUTE_STATUSES] as string[] },
  { key: 'done', label: 'Resolved & closed', statuses: ['resolved_contractor', 'resolved_facility', 'closed'] },
  { key: 'all', label: 'All', statuses: Object.keys(STATUS) },
]

interface DisputeRow {
  id: string
  contract_id: string
  opened_by: string
  against: string
  status: string
  reason: string
  description: string | null
  resolution: string | null
  resolved_at: string | null
  created_at: string
  contracts: { title: string | null } | null
}

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  if (isDemoMode()) return <AdminDemoNotice />

  const { tab = 'open' } = await searchParams
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0]
  const { db } = await requireAdmin()

  const { data, error } = await db
    .from('disputes')
    .select('id, contract_id, opened_by, against, status, reason, description, resolution, resolved_at, created_at, contracts(title)')
    .in('status', activeTab.statuses)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) console.error('[admin/disputes] load failed', error)
  const disputes = (data ?? []) as unknown as DisputeRow[]

  const partyIds = [...new Set(disputes.flatMap((d) => [d.opened_by, d.against]))]
  const names = new Map<string, string>()
  if (partyIds.length) {
    const [pros, orgs, accounts] = await Promise.all([
      db.from('contractor_profiles').select('id, first_name, last_name').in('id', partyIds),
      db.from('facility_profiles').select('id, facility_name').in('id', partyIds),
      db.from('profiles').select('id, email').in('id', partyIds),
    ])
    for (const a of accounts.data ?? []) if (a.email) names.set(a.id, a.email)
    for (const o of orgs.data ?? []) if (o.facility_name) names.set(o.id, o.facility_name)
    for (const p of pros.data ?? []) {
      const n = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
      if (n) names.set(p.id, n)
    }
  }
  const party = (id: string) => (
    <Link href={`/admin/users/${id}`} className="text-[#404145] hover:text-[#1dbf73] hover:underline">
      {names.get(id) ?? id.slice(0, 8)}
    </Link>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'open' ? '/admin/inbox/disputes' : `/admin/inbox/disputes?tab=${t.key}`}
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
          <CardContent className="py-4 text-sm text-red-700">Couldn&apos;t load disputes. Check the server logs.</CardContent>
        </Card>
      )}

      {!error && disputes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[#62646a]">
            No disputes here. Disputes are opened by either side of a contract.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => {
            const s = STATUS[d.status] ?? { label: d.status, className: 'bg-gray-100 text-gray-700' }
            return (
              <Card key={d.id}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={s.className}>{s.label}</Badge>
                    <h3 className="font-semibold text-[#404145]">{d.reason}</h3>
                  </div>
                  <p className="text-xs text-[#62646a]">
                    {party(d.opened_by)} vs {party(d.against)}
                    {d.contracts?.title ? ` · ${d.contracts.title}` : ''} · opened {formatDateTime(d.created_at)} (
                    {formatRelativeTime(d.created_at)})
                  </p>
                  {d.description && (
                    <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-[#404145]">{d.description}</p>
                  )}
                  {d.resolution && (
                    <p className="text-sm text-[#404145]">
                      <span className="font-medium">Resolution:</span> {d.resolution}
                    </p>
                  )}
                  <form
                    action={updateDispute.bind(null, d.id)}
                    className="flex flex-wrap items-center gap-2 border-t border-[#f1f3f5] pt-3"
                  >
                    <select
                      name="status"
                      defaultValue={d.status}
                      className="h-9 rounded-md border border-[#e4e5e7] bg-white px-2 text-sm"
                    >
                      {Object.entries(STATUS).map(([value, { label }]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      name="resolution"
                      defaultValue={d.resolution ?? ''}
                      placeholder="Resolution notes (required to resolve or close)"
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
