import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'
import { formatDateTime } from '@/lib/utils/format'
import { formatUsPhone } from '@/lib/phone'
import { loadCareRequests, type CareRequestItem } from '@/lib/admin/care-requests'
import {
  CLIENT_INTEREST_LABELS,
  HELP_TIMELINES,
  MEETING_FORMATS,
} from '@/lib/onboarding/client-interests'
import { CareRequestActions } from './request-actions'

export const dynamic = 'force-dynamic'

const label = (opts: readonly { value: string; label: string }[], v: string | null) =>
  v ? (opts.find((o) => o.value === v)?.label ?? v) : '—'

const STATUS_LABEL = { open: 'Open', contacted: 'Contacted', closed: 'Closed' } as const

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-[#9ca3af]">{name}</dt>
      <dd className="break-words text-sm text-[#404145]">{children}</dd>
    </div>
  )
}

function RequestCard({ r }: { r: CareRequestItem }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base text-[#404145]">
            {r.name}
            <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
          </CardTitle>
          <CardDescription>
            Asked {formatDateTime(r.createdAt)}
            {r.handledAt ? ` · updated ${formatDateTime(r.handledAt)}` : ''}
          </CardDescription>
        </div>
        <Link href={`/admin/users/${r.userId}`} className="text-sm text-[#62646a] hover:text-[#1dbf73]">
          Full account →
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field name="Email">{r.email ?? '—'}</Field>
          <Field name="Phone">{r.phone ? formatUsPhone(r.phone) : '—'}</Field>
          <Field name="ZIP">{r.zip ?? '—'}</Field>
          <Field name="Looking for">
            {r.interests.length ? r.interests.map((k) => CLIENT_INTEREST_LABELS[k] ?? k).join(', ') : '—'}
          </Field>
          <Field name="How soon">{label(HELP_TIMELINES, r.timeline)}</Field>
          <Field name="How to meet">
            {r.formats.length ? r.formats.map((f) => label(MEETING_FORMATS, f)).join(', ') : '—'}
          </Field>
          {r.note && (
            <div className="min-w-0 sm:col-span-2 lg:col-span-3">
              <dt className="text-xs uppercase tracking-wide text-[#9ca3af]">Note</dt>
              <dd className="whitespace-pre-wrap break-words text-sm text-[#404145]">{r.note}</dd>
            </div>
          )}
        </dl>
        <CareRequestActions id={r.id} status={r.status} />
      </CardContent>
    </Card>
  )
}

export default async function CareRequestsPage() {
  if (isDemoMode()) return <AdminDemoNotice />

  const { admin, db } = await requireAdmin()
  const requests = await loadCareRequests(db)
  const active = requests.filter((r) => r.status !== 'closed')
  const closed = requests.filter((r) => r.status === 'closed')

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'admin_view_care_requests',
    targetTable: 'care_requests',
    metadata: { active: active.length },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Care requests</h1>
        <p className="mt-1 text-sm text-[#62646a]">
          Clients whose results showed fewer than 3 matching professionals and asked for help finding
          someone. Reach out by email, then mark the request contacted, and closed once it&apos;s resolved.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#404145]">
          Waiting <Badge variant="outline" className="ml-1 align-middle">{active.length}</Badge>
        </h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-[#6b7280]">No open requests.</CardContent>
          </Card>
        ) : (
          active.map((r) => <RequestCard key={r.id} r={r} />)
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#404145]">Recently closed</h2>
          {closed.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </section>
      )}
    </div>
  )
}
