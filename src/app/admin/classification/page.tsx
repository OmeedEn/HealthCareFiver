import Link from 'next/link'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'
import { formatDateTime } from '@/lib/utils/format'
import { formatUsPhone } from '@/lib/phone'
import {
  loadClassificationQueue,
  loadRecentAnswers,
  loadSignupPathReport,
  splitWebsiteAnswer,
  type ClassificationRequestRow,
  type SignupPathShare,
} from '@/lib/admin/classification'
import {
  SIGNUP_PATH_SHORT_LABELS,
  UNSURE_CREDENTIALS,
  UNSURE_SHARE_ALERT,
  UNSURE_TEAM_SIZES,
  UNSURE_WANTS,
  isSignupPath,
} from '@/lib/onboarding/signup-path'
import { ClassifyActions } from './classify-actions'

export const dynamic = 'force-dynamic'

const label = (opts: readonly { value: string; label: string }[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-[#9ca3af]">{name}</dt>
      <dd className="break-words text-sm text-[#404145]">{children}</dd>
    </div>
  )
}

function WebsiteAnswer({ value }: { value: string | null }) {
  if (!value) return <>—</>
  const { website, linkedin } = splitWebsiteAnswer(value)
  const href = website ?? linkedin
  if (!href) return <>{value}</>
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[#0f8f56] hover:underline">
      {value} <ExternalLink className="size-3" />
    </a>
  )
}

function Answers({ r }: { r: ClassificationRequestRow }) {
  return (
    <>
      <Field name="City / state">{r.city}, {r.state}</Field>
      <Field name="Team size">{label(UNSURE_TEAM_SIZES, r.team_size)}</Field>
      <Field name="Physical location">{r.has_location ? 'Yes' : 'No'}</Field>
      <Field name="License or certification">{label(UNSURE_CREDENTIALS, r.credential)}</Field>
      <Field name="Website / LinkedIn"><WebsiteAnswer value={r.website} /></Field>
      <Field name="Wants to">
        {r.wants.length ? r.wants.map((w) => label(UNSURE_WANTS, w)).join(', ') : '—'}
      </Field>
    </>
  )
}

function pct(n: number, total: number): string {
  return total ? `${Math.round((n / total) * 1000) / 10}%` : '—'
}

function ShareReport({ rows }: { rows: SignupPathShare[] }) {
  const total30 = rows.reduce((s, r) => s + r.last30, 0)
  const totalAll = rows.reduce((s, r) => s + r.allTime, 0)
  const unsure = rows.find((r) => r.path === 'UNSURE')
  const share30 = total30 ? (unsure?.last30 ?? 0) / total30 : 0
  const shareAll = totalAll ? (unsure?.allTime ?? 0) / totalAll : 0
  // Judge on the last 30 days; fall back to all time when nobody signed up recently.
  const share = total30 ? share30 : shareAll
  const alert = share > UNSURE_SHARE_ALERT

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-[#404145]">Signups by door</CardTitle>
        <CardDescription>
          Non-admin accounts by the door they signed up through. &ldquo;No door&rdquo; is accounts created
          outside the two-door signup (e.g. invited or pre-backfill).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {alert && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>{Math.round(share * 1000) / 10}%</strong> of signups
              {total30 ? ' in the last 30 days' : ''} chose &ldquo;Not sure&rdquo; (alert above {Math.round(UNSURE_SHARE_ALERT * 100)}%). The
              door subtitles need rewriting — check the answers below for missing categories.
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-[#9ca3af]">
                <th className="py-2 pr-4 font-medium">Door</th>
                <th className="py-2 pr-4 text-right font-medium">Last 30 days</th>
                <th className="py-2 pr-4 text-right font-medium">Share</th>
                <th className="py-2 pr-4 text-right font-medium">All time</th>
                <th className="py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path ?? 'none'} className={`border-b border-[#f1f3f5] ${r.path === 'UNSURE' && alert ? 'bg-amber-50' : ''}`}>
                  <td className="py-2 pr-4 text-[#404145]">{r.path ? SIGNUP_PATH_SHORT_LABELS[r.path] : 'No door'}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.last30}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[#62646a]">{pct(r.last30, total30)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.allTime}</td>
                  <td className="py-2 text-right tabular-nums text-[#62646a]">{pct(r.allTime, totalAll)}</td>
                </tr>
              ))}
              <tr className="font-medium text-[#404145]">
                <td className="py-2 pr-4">Total</td>
                <td className="py-2 pr-4 text-right tabular-nums">{total30}</td>
                <td />
                <td className="py-2 pr-4 text-right tabular-nums">{totalAll}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#6b7280]">
          Not sure share: {pct(unsure?.last30 ?? 0, total30)} in the last 30 days, {pct(unsure?.allTime ?? 0, totalAll)} all
          time. Alert threshold {Math.round(UNSURE_SHARE_ALERT * 100)}%.
        </p>
      </CardContent>
    </Card>
  )
}

export default async function ClassificationPage() {
  if (isDemoMode()) return <AdminDemoNotice />

  const { admin, db } = await requireAdmin()
  const [queue, report, answers] = await Promise.all([
    loadClassificationQueue(db),
    loadSignupPathReport(db),
    loadRecentAnswers(db, 50),
  ])

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'admin_view_classification_queue',
    targetTable: 'classification_requests',
    metadata: { pending: queue.length },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Needs classification</h1>
        <p className="mt-1 text-sm text-[#62646a]">
          People who picked &ldquo;Not sure&rdquo; at signup. Until they&apos;re placed they can browse, save,
          and book as a client, but can&apos;t message professionals. Assigning switches their account type
          and emails them a Finish setup link; rejecting keeps them a client.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#404145]">
          Waiting <Badge variant="outline" className="ml-1 align-middle">{queue.length}</Badge>
        </h2>
        {queue.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-[#6b7280]">Nobody is waiting for placement.</CardContent>
          </Card>
        ) : (
          queue.map((item) => (
            <Card key={item.userId}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-[#404145]">{item.name}</CardTitle>
                  <CardDescription>Signed up {formatDateTime(item.signedUpAt)}</CardDescription>
                </div>
                <Link href={`/admin/users/${item.userId}`} className="text-sm text-[#62646a] hover:text-[#1dbf73]">
                  Full account →
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field name="Email">{item.email ?? '—'}</Field>
                  <Field name="Phone">{item.phone ? formatUsPhone(item.phone) : '—'}</Field>
                  {item.request ? (
                    <>
                      <div className="min-w-0 sm:col-span-2 lg:col-span-3">
                        <dt className="text-xs uppercase tracking-wide text-[#9ca3af]">What they do</dt>
                        <dd className="whitespace-pre-wrap break-words text-sm text-[#404145]">{item.request.what_you_do}</dd>
                      </div>
                      <Answers r={item.request} />
                    </>
                  ) : (
                    <Field name="Answers">
                      <span className="text-[#b8860b]">Hasn&apos;t answered the Not sure questions yet.</span>
                    </Field>
                  )}
                </dl>
                <ClassifyActions userId={item.userId} name={item.name} />
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <ShareReport rows={report} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#404145]">Recent &ldquo;What do you do?&rdquo; answers</CardTitle>
          <CardDescription>
            The latest {answers.length} Not sure answers, including ones already placed — look for
            recurring kinds of work that don&apos;t fit an existing door.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {answers.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No answers yet.</p>
          ) : (
            <ul className="divide-y divide-[#f1f3f5]">
              {answers.map((a) => (
                <li key={a.user_id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-[#404145]">{a.what_you_do}</p>
                    <p className="mt-1 text-xs text-[#6b7280]">
                      <Link href={`/admin/users/${a.user_id}`} className="hover:text-[#1dbf73]">{a.name}</Link>
                      {' · '}{label(UNSURE_TEAM_SIZES, a.team_size)} · {a.city}, {a.state} · {formatDateTime(a.created_at)}
                    </p>
                    {a.decision_note && <p className="mt-1 text-xs text-[#62646a]">Note: {a.decision_note}</p>}
                  </div>
                  <Badge variant="outline">
                    {a.decision === 'REJECTED'
                      ? 'Rejected'
                      : isSignupPath(a.decision)
                        ? SIGNUP_PATH_SHORT_LABELS[a.decision]
                        : 'Waiting'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
