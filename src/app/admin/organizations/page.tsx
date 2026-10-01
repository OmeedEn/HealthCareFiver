import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/guard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import {
  ORG_STATUSES,
  ORG_STATUS_BADGE,
  ORG_STATUS_LABEL,
  checklistProgress,
  isOrgStatus,
  type OrgChecklist,
  type OrgStatus,
} from '@/lib/org/review'
import { FREE_EMAIL_DOMAINS, emailDomain } from '@/lib/org/red-flags'

export const dynamic = 'force-dynamic'

const OPEN: OrgStatus[] = ['pending_review', 'needs_info']
type Filter = 'open' | 'all' | OrgStatus

interface Row {
  id: string
  facility_name: string
  facility_type: string
  city: string | null
  state: string | null
  verification_status: string
  admin_checklist: OrgChecklist | null
  created_at: string
  updated_at: string
  profiles: { email: string | null } | null
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { db } = await requireAdmin()
  const { status } = await searchParams
  const filter: Filter = status === 'all' || isOrgStatus(status) ? (status as Filter) : 'open'

  const { data, error } = await db
    .from('facility_profiles')
    .select(
      'id, facility_name, facility_type, city, state, verification_status, admin_checklist, created_at, updated_at, profiles!facility_profiles_id_fkey(email)'
    )
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) console.error('[admin/organizations] load failed', error)

  const all = (data ?? []) as unknown as Row[]
  const counts = Object.fromEntries(
    ORG_STATUSES.map((s) => [s, all.filter((r) => r.verification_status === s).length])
  ) as Record<OrgStatus, number>
  const rows = all.filter((r) =>
    filter === 'all'
      ? true
      : filter === 'open'
        ? OPEN.includes(r.verification_status as OrgStatus)
        : r.verification_status === filter
  )

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'open', label: 'Needs review', count: counts.pending_review + counts.needs_info },
    ...ORG_STATUSES.map((s) => ({ key: s as Filter, label: ORG_STATUS_LABEL[s], count: counts[s] })),
    { key: 'all', label: 'All', count: all.length },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Organizations</h1>
        <p className="text-sm text-[#62646a]">
          Every organization is reviewed before it can publish, message professionals, or review
          applicants. Oldest first.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'open' ? '/admin/organizations' : `/admin/organizations?status=${t.key}`}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              filter === t.key
                ? 'border-[#1dbf73] bg-[#e8faf1] font-semibold text-[#0f8f56]'
                : 'border-[#e4e5e7] text-[#62646a] hover:border-[#1dbf73]'
            )}
          >
            {t.label} <span className="text-xs opacity-70">{t.count}</span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} organization{rows.length === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-red-600">Could not load organizations. Check the server logs.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[#62646a]">Nothing here.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Signed up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const s = isOrgStatus(r.verification_status) ? r.verification_status : 'pending_review'
                  const { done, total } = checklistProgress(r.admin_checklist)
                  const freeEmail = FREE_EMAIL_DOMAINS.has(emailDomain(r.profiles?.email))
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/admin/organizations/${r.id}`}
                          className="font-semibold text-[#404145] hover:text-[#1dbf73]"
                        >
                          {r.facility_name || 'Unnamed organization'}
                        </Link>
                        <div className="text-xs text-[#62646a]">{r.profiles?.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {[r.city, r.state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ORG_STATUS_BADGE[s]}>{ORG_STATUS_LABEL[s]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {done}/{total}
                      </TableCell>
                      <TableCell>
                        {freeEmail && <Badge variant="outline">Free email</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-[#62646a]">
                        {formatRelativeTime(r.created_at)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
