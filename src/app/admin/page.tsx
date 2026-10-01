import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/utils/format'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { countCreatedWithinDays, listAdminUsers, recentActivity } from '@/lib/admin/data'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import {
  EmailConfirmedBadge,
  SeverityBadge,
  VerificationBadge,
} from '@/components/admin/status-badges'
import {
  Users,
  UserPlus,
  LogIn,
  MailCheck,
  ShieldCheck,
  Bug,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  href,
}: {
  title: string
  value: number
  description: string
  icon: LucideIcon
  href?: string
}) {
  const body = (
    <Card className="h-full transition-colors hover:border-[#1dbf73]/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#62646a]">{title}</CardTitle>
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#1dbf73]/10">
          <Icon className="size-4 text-[#1dbf73]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[#404145]">{value}</div>
        <p className="mt-1 text-xs text-[#62646a]">{description}</p>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{body}</Link> : body
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

export default async function AdminOverviewPage() {
  if (isDemoMode()) return <AdminDemoNotice />

  const { db } = await requireAdmin()
  const users = await listAdminUsers(db)
  const [activity, openBugs, { count: pendingCreds }] = await Promise.all([
    recentActivity(db, users, 12),
    db
      .from('bug_reports')
      .select('id, title, severity, created_at')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5),
    db
      .from('credentials')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
  ])

  const newThisWeek = countCreatedWithinDays(users, 7)
  const everSignedIn = users.filter((u) => u.lastSignInAt).length
  const confirmed = users.filter((u) => u.emailConfirmedAt).length
  const awaitingVerification = users.filter(
    (u) => u.verificationStatus === 'pending_review' || u.verificationStatus === 'more_info_requested'
  ).length
  const openBugCount = openBugs.data?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Overview</h1>
        <p className="mt-1 text-sm text-[#62646a]">
          Live from Supabase: who signed up, who&apos;s logged in, and what needs attention.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total accounts" value={users.length} description="All auth users" icon={Users} href="/admin/users" />
        <StatCard title="New this week" value={newThisWeek} description="Created in the last 7 days" icon={UserPlus} href="/admin/users" />
        <StatCard title="Have logged in" value={everSignedIn} description={`${users.length - everSignedIn} never signed in`} icon={LogIn} href="/admin/users?filter=never_signed_in" />
        <StatCard title="Email confirmed" value={confirmed} description={`${users.length - confirmed} unconfirmed`} icon={MailCheck} href="/admin/users?filter=unconfirmed" />
        <StatCard title="Awaiting verification" value={awaitingVerification} description={`${pendingCreds ?? 0} credential docs pending`} icon={ShieldCheck} href="/admin/users?filter=needs_review" />
        <StatCard title="Open bugs" value={openBugCount} description="Open or in progress" icon={Bug} href="/admin/bugs" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-[#404145]">Newest accounts</CardTitle>
            <Link href="/admin/users" className="text-xs text-[#1dbf73] hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-[#6b7280]">No accounts yet.</p>
            ) : (
              <ul className="divide-y divide-[#f1f3f5]">
                {users.slice(0, 8).map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-[#404145] hover:underline">
                        {u.name}
                      </Link>
                      <p className="truncate text-xs text-[#62646a]">
                        {u.email} · {u.role ?? 'no role'} · joined {formatRelativeTime(u.createdAt)}
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-[#404145]">Status updates</CardTitle>
            <Link href="/admin/activity" className="text-xs text-[#1dbf73] hover:underline">Full feed</Link>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-[#6b7280]">No activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-[#404145]">{a.text}</span>
                    <span className="shrink-0 text-xs text-[#6b7280]">{formatRelativeTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-[#404145]">Open bugs</CardTitle>
            <Link href="/admin/bugs" className="text-xs text-[#1dbf73] hover:underline">Triage</Link>
          </CardHeader>
          <CardContent>
            {openBugCount === 0 ? (
              <p className="text-sm text-[#6b7280]">No open bug reports.</p>
            ) : (
              <ul className="space-y-2.5">
                {openBugs.data!.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <SeverityBadge severity={b.severity} />
                      <span className="truncate text-[#404145]">{b.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-[#6b7280]">{formatRelativeTime(b.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#404145]">System status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
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
    </div>
  )
}
