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
      u.verificationStatus === 'pending_review' ||
      u.verificationStatus === 'more_info_requested' ||
      u.verificationStatus === 'needs_info',
  },
  never_signed_in: { label: 'Never signed in', test: (u) => !u.lastSignInAt },
  unconfirmed: { label: 'Email unconfirmed', test: (u) => !u.emailConfirmedAt },
  suspended: { label: 'Suspended', test: (u) => !u.isActive },
}

const ROLES: { value: string; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'contractor', label: 'Professionals' },
  { value: 'facility', label: 'Organizations' },
  { value: 'staffing_agency', label: 'Staffing agencies' },
  { value: 'client', label: 'Clients' },
  { value: 'admin', label: 'Admins' },
]
const ROLE_LABEL: Record<string, string> = {
  contractor: 'Professional',
  facility: 'Organization',
  staffing_agency: 'Staffing agency',
  client: 'Client',
  admin: 'Admin',
}

export default async function AdminPeoplePage({
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
    return `/admin/people${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a17]">People</h1>
          <p className="mt-1 text-sm text-[#5f5d57]">
            {users.length} accounts · professionals, organizations and clients. Click a name for details, notes, category and suspend.
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2" action="/admin/people">
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, phone…"
            className="h-9 w-64 rounded-md border border-[#e3dfd6] bg-white px-3 text-sm outline-none focus:border-[#2f3cf5]"
          />
          <select
            name="role"
            defaultValue={role}
            className="h-9 rounded-md border border-[#e3dfd6] bg-white px-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md bg-[#2f3cf5] px-3 text-sm font-medium text-white hover:bg-[#2330c8]">
            Search
          </button>
        </form>
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#e3dfd6] bg-white p-1">
        {ROLES.filter((r) => r.value === 'all' || users.some((u) => u.role === r.value)).map((r) => (
          <Link
            key={r.value}
            href={hrefWith({ role: r.value })}
            className={`rounded-md px-3 py-1.5 text-sm ${
              role === r.value
                ? 'bg-[#eceefe] font-semibold text-[#2330c8]'
                : 'text-[#5f5d57] hover:text-[#2f3cf5]'
            }`}
          >
            {r.label}{' '}
            <span className="text-xs opacity-70">
              {r.value === 'all' ? users.length : users.filter((u) => u.role === r.value).length}
            </span>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(FILTERS).map(([key, f]) => (
          <Link
            key={key}
            href={hrefWith({ filter: key })}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === key || (key === 'all' && !FILTERS[filter])
                ? 'border-[#2f3cf5] bg-[#eceefe] text-[#2330c8]'
                : 'border-[#e3dfd6] bg-white text-[#5f5d57] hover:border-[#2f3cf5]'
            }`}
          >
            {f.label} ({users.filter(f.test).length})
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#5f5d57]">No users match.</p>
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
                      <Link href={`/admin/users/${u.id}`} className="text-[#1a1a17] hover:text-[#2f3cf5] hover:underline">
                        {u.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[#5f5d57]">{u.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role ? (ROLE_LABEL[u.role] ?? u.role) : 'no profile'}</Badge>
                    </TableCell>
                    <TableCell className="text-[#5f5d57]" title={u.createdAt}>
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <EmailConfirmedBadge at={u.emailConfirmedAt} />
                    </TableCell>
                    <TableCell className="text-[#5f5d57]">
                      {u.lastSignInAt ? formatRelativeTime(u.lastSignInAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <VerificationBadge status={u.verificationStatus} />
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge className="bg-[#eceefe] text-[#2330c8]">Active</Badge>
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
