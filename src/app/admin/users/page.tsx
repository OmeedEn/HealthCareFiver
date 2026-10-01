import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatRelativeTime } from '@/lib/utils/format'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { listAdminUsers, type AdminUserRow } from '@/lib/admin/data'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { EmailConfirmedBadge, VerificationBadge } from '@/components/admin/status-badges'

export const dynamic = 'force-dynamic'

const FILTERS: Record<string, { label: string; test: (u: AdminUserRow) => boolean }> = {
  all: { label: 'All', test: () => true },
  needs_review: {
    label: 'Needs review',
    test: (u) =>
      u.verificationStatus === 'pending_review' || u.verificationStatus === 'more_info_requested',
  },
  never_signed_in: { label: 'Never signed in', test: (u) => !u.lastSignInAt },
  unconfirmed: { label: 'Email unconfirmed', test: (u) => !u.emailConfirmedAt },
  suspended: { label: 'Suspended', test: (u) => !u.isActive },
}

const ROLES = ['all', 'contractor', 'facility', 'staffing_agency', 'client', 'admin']

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; filter?: string }>
}) {
  if (isDemoMode()) return <AdminDemoNotice />

  const { q = '', role = 'all', filter = 'all' } = await searchParams
  const { db } = await requireAdmin()
  const users = await listAdminUsers(db)

  const term = q.trim().toLowerCase()
  const activeFilter = FILTERS[filter] ?? FILTERS.all
  const visible = users.filter(
    (u) =>
      activeFilter.test(u) &&
      (role === 'all' || u.role === role) &&
      (!term ||
        u.name.toLowerCase().includes(term) ||
        (u.email ?? '').toLowerCase().includes(term) ||
        (u.phone ?? '').includes(term))
  )

  const hrefWith = (patch: Record<string, string>) => {
    const params = new URLSearchParams({ q, role, filter, ...patch })
    for (const [k, v] of [...params]) if (!v || v === 'all') params.delete(k)
    const s = params.toString()
    return `/admin/users${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">Users</h1>
          <p className="mt-1 text-sm text-[#62646a]">
            {users.length} accounts · click a name for full details and verification.
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2" action="/admin/users">
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, phone…"
            className="h-9 w-64 rounded-md border border-[#e4e5e7] bg-white px-3 text-sm outline-none focus:border-[#1dbf73]"
          />
          <select
            name="role"
            defaultValue={role}
            className="h-9 rounded-md border border-[#e4e5e7] bg-white px-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === 'all' ? 'All roles' : r.replace('_', ' ')}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md bg-[#1dbf73] px-3 text-sm font-medium text-white hover:bg-[#19a463]">
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(FILTERS).map(([key, f]) => (
          <Link
            key={key}
            href={hrefWith({ filter: key })}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === key || (key === 'all' && !FILTERS[filter])
                ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                : 'border-[#e4e5e7] bg-white text-[#62646a] hover:border-[#1dbf73]'
            }`}
          >
            {f.label} ({users.filter(f.test).length})
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#62646a]">No users match.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/users/${u.id}`} className="text-[#404145] hover:text-[#1dbf73] hover:underline">
                        {u.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[#62646a]">{u.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role ?? 'no profile'}</Badge>
                    </TableCell>
                    <TableCell className="text-[#62646a]" title={u.createdAt}>
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <EmailConfirmedBadge at={u.emailConfirmedAt} />
                    </TableCell>
                    <TableCell className="text-[#62646a]">
                      {u.lastSignInAt ? formatRelativeTime(u.lastSignInAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <VerificationBadge status={u.verificationStatus} />
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge className="bg-[#e8faf1] text-[#0f8f56]">Active</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">Suspended</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
