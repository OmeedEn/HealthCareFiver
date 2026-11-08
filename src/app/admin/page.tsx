import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { countCreatedWithinDays, listAdminUsers } from '@/lib/admin/data'
import { getQueueCounts, inboxTotal, reviewTotal } from '@/lib/admin/queue-counts'
import { INBOX_TABS, REVIEW_TABS } from '@/lib/admin/sections'
import { countLiveListings, loadOldestPending } from '@/lib/admin/overview'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { EmailConfirmedBadge, VerificationBadge } from '@/components/admin/status-badges'
import { CheckCircle2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  contractor: 'professional',
  facility: 'organization',
  staffing_agency: 'staffing agency',
  client: 'client',
  admin: 'admin',
}

/** Which integrations have real credentials vs. running on built-in mocks. */
function integrationStatus() {
  const has = (...keys: string[]) => keys.every((k) => Boolean(process.env[k]))
  return [
    { name: 'Supabase service role', live: has('SUPABASE_SERVICE_ROLE_KEY') },
    { name: 'Stripe', live: has('STRIPE_SECRET_KEY') },
    { name: 'Stripe webhooks', live: has('STRIPE_WEBHOOK_SECRET') },
    { name: 'Medallion (licenses)', live: has('MEDALLION_API_KEY') },
    { name: 'Checkr (background)', live: has('CHECKR_API_KEY') },
    { name: 'DocuSign (BAA)', live: has('DOCUSIGN_INTEGRATION_KEY') },
    { name: 'Resend (email)', live: has('RESEND_API_KEY') },
    { name: 'Sentry (errors)', live: has('NEXT_PUBLIC_SENTRY_DSN') || has('SENTRY_DSN') },
  ]
}

function Stat({ label, value, sub, href }: { label: string; value: number; sub?: string; href: string }) {
  return (
    <Link href={href} className="block rounded-lg border border-[#e4e5e7] bg-white p-4 transition-colors hover:border-[#1dbf73]/60">
      <p className="text-xs font-medium text-[#62646a]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#404145]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#62646a]">{sub}</p>}
    </Link>
  )
}

function QueueTile({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
        count > 0
          ? 'border-[#1dbf73]/40 bg-[#e8faf1] text-[#0f8f56] hover:border-[#1dbf73]'
          : 'border-[#e4e5e7] bg-white text-[#95979d] hover:border-[#1dbf73]/60'
      )}
    >
      <span className={count > 0 ? 'font-medium' : ''}>{label}</span>
      <span className="text-lg font-bold">{count}</span>
    </Link>
  )
}

export default async function AdminOverviewPage() {
  if (isDemoMode()) return <AdminDemoNotice />

  const { db } = await requireAdmin()
  const users = await listAdminUsers(db)
  const byId = new Map(users.map((u) => [u.id, u]))
  const nameOf = (id: string) => {
    const u = byId.get(id)
    return u ? (u.name !== '—' ? u.name : (u.email ?? id.slice(0, 8))) : id.slice(0, 8)
  }

  const [counts, pending, liveListings] = await Promise.all([
    getQueueCounts(),
    loadOldestPending(db, nameOf, 15),
    countLiveListings(db).catch(() => 0),
  ])
  const waiting = reviewTotal(counts) + inboxTotal(counts)

  const nonAdmins = users.filter((u) => u.role !== 'admin')
  const pros = nonAdmins.filter((u) => u.role === 'contractor')
  const orgs = nonAdmins.filter((u) => u.role === 'facility' || u.role === 'staffing_agency')
  const clients = nonAdmins.filter((u) => u.role === 'client')
  const approvedPros = pros.filter((u) => u.verificationStatus === 'approved').length
  const approvedOrgs = orgs.filter((u) => u.verificationStatus === 'approved').length
  const newThisWeek = countCreatedWithinDays(nonAdmins, 7)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Overview</h1>
        <p className="mt-1 text-sm text-[#62646a]">
          {waiting === 0 ? 'Nothing is waiting on you right now.' : `${waiting} item${waiting === 1 ? '' : 's'} waiting on an admin.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Accounts" value={nonAdmins.length} sub={`${newThisWeek} new this week`} href="/admin/people" />
        <Stat label="Professionals" value={pros.length} sub={`${approvedPros} approved`} href="/admin/people?role=contractor" />
        <Stat label="Organizations" value={orgs.length} sub={`${approvedOrgs} approved`} href="/admin/people?role=facility" />
        <Stat label="Clients" value={clients.length} href="/admin/people?role=client" />
        <Stat label="Live listings" value={liveListings} sub="Pro + org, published" href="/admin/review/listings" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#404145]">Needs your attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#95979d]">Review</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {REVIEW_TABS.map((t) => (
                <QueueTile key={t.href} label={t.label} count={counts[t.key]} href={t.href} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#95979d]">Inbox</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {INBOX_TABS.map((t) => (
                <QueueTile key={t.href} label={t.label} count={counts[t.key]} href={t.href} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#404145]">Waiting longest</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-[#6b7280]">All clear.</p>
            ) : (
              <ul className="divide-y divide-[#f1f3f5]">
                {pending.map((p) => (
                  <li key={p.key}>
                    <Link href={p.href} className="flex items-center justify-between gap-3 py-2.5 hover:text-[#1dbf73]">
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="shrink-0">{p.kind}</Badge>
                        <span className="truncate text-sm text-[#404145]">{p.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-[#6b7280]" title={formatDateTime(p.at)}>
                        {formatRelativeTime(p.at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-[#404145]">Recent signups</CardTitle>
            <Link href="/admin/people" className="text-xs text-[#1dbf73] hover:underline">
              Everyone
            </Link>
          </CardHeader>
          <CardContent>
            {nonAdmins.length === 0 ? (
              <p className="text-sm text-[#6b7280]">No accounts yet.</p>
            ) : (
              <ul className="divide-y divide-[#f1f3f5]">
                {nonAdmins.slice(0, 10).map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-[#404145] hover:underline">
                        {u.name}
                      </Link>
                      <p className="truncate text-xs text-[#62646a]">
                        {u.email} · {u.role ? (ROLE_LABEL[u.role] ?? u.role) : 'no profile'} · joined{' '}
                        {formatRelativeTime(u.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <EmailConfirmedBadge at={u.emailConfirmedAt} />
                      {u.verificationStatus && <VerificationBadge status={u.verificationStatus} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#404145]">Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {integrationStatus().map((i) => (
              <li key={i.name} className="flex items-center gap-2 text-sm text-[#404145]">
                {i.live ? (
                  <CheckCircle2 className="size-4 text-[#1dbf73]" />
                ) : (
                  <XCircle className="size-4 text-[#9ca3af]" />
                )}
                {i.name}
                <span className="text-xs text-[#6b7280]">{i.live ? 'live' : 'mock / off'}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
