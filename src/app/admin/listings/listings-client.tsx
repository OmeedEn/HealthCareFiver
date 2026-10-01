'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle, Loader2, Pause, Pencil, ShieldCheck } from 'lucide-react'

export interface ListingRow {
  id: string
  contractorId: string
  providerName: string
  category: string | null
  otherProfession: string | null
  /** Holds a state license (clinical question set). */
  licensed: boolean
  scope: string
  kind: string
  title: string
  description: string | null
  format: string | null
  involvesMedicalProcedures: boolean
  requiresMalpractice: boolean
  insured: boolean
  priceCents: number | null
  isFree: boolean
  status: string
  reviewNotes: string | null
  reviewedAt: string | null
  updatedAt: string
  /** Best-effort preview of why the DB would refuse to publish. */
  publishBlockers: string[]
}

type Action = 'publish' | 'request_changes' | 'pause'

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending review',
  published: 'Published',
  paused: 'Paused',
  rejected: 'Changes requested',
}

const STATUSES = ['pending_review', 'published', 'paused', 'rejected']

/** Claims we never allow: cures, guarantees, miracle/reversal language. */
const RISKY_RE =
  /\b(cur(?:e|es|ed|ing)|guarantee(?:s|d)?|miracle(?:s)?|miraculous|revers(?:e|es|ed|ing|al))\b|100\s?%/gi

function riskyWords(text: string): string[] {
  return [...new Set((text.match(RISKY_RE) ?? []).map((w) => w.toLowerCase()))]
}

function Highlighted({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(RISKY_RE)) {
    const start = m.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <mark key={start} className="rounded bg-red-200 px-0.5 font-semibold text-red-900">
        {m[0]}
      </mark>
    )
    last = start + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

const REVIEW_CHECKS = [
  { key: 'scope', label: 'Services fit the provider’s license / certification scope' },
  { key: 'diagnosis', label: 'No diagnosing or treating outside that scope' },
  { key: 'claims', label: 'No “cure” or guaranteed-results language' },
  {
    key: 'procedures',
    label: 'No prescribing, IVs, or injectables unless the provider is licensed to do them',
  },
] as const

function price(row: ListingRow): string {
  if (row.isFree) return 'Free'
  if (row.priceCents == null) return 'Custom quote'
  return formatCurrency(row.priceCents / 100)
}

function ListingCard({
  row,
  demo,
  onUpdated,
}: {
  row: ListingRow
  demo: boolean
  onUpdated: (id: string, patch: Partial<ListingRow>) => void
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState(row.reviewNotes ?? '')
  const [submitting, setSubmitting] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)

  const flagged = riskyWords(`${row.title} ${row.description ?? ''}`)
  const unlicensedProcedures = row.involvesMedicalProcedures && !row.licensed
  const allChecked = REVIEW_CHECKS.every((c) => checked[c.key])

  async function act(action: Action) {
    setError(null)
    if (action === 'request_changes' && !notes.trim()) {
      setError('Write what the provider needs to change.')
      return
    }
    if (demo) {
      toast.info('Demo mode — nothing is saved')
      return
    }
    setSubmitting(action)
    try {
      const res = await fetch(`/api/admin/listings/${row.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes.trim() || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Request failed')
      onUpdated(row.id, {
        status: body.offering.status,
        reviewNotes: body.offering.review_notes,
        reviewedAt: body.offering.reviewed_at,
      })
      toast.success(`Listing ${STATUS_LABEL[body.offering.status]?.toLowerCase() ?? 'updated'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              <Highlighted text={row.title} />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/admin/verification/${row.contractorId}`}
                className="font-medium text-foreground hover:underline"
              >
                {row.providerName}
              </Link>
              {row.category === 'other' && (
                <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700">
                  Other: {row.otherProfession ?? '?'}
                </Badge>
              )}
              {' · '}
              {row.kind}
              {row.format ? ` · ${row.format.replace(/_/g, ' ')}` : ''} · {price(row)} · updated{' '}
              {formatRelativeTime(row.updatedAt)}
            </p>
          </div>
          <Badge variant={row.status === 'published' ? 'default' : 'secondary'}>
            {STATUS_LABEL[row.status] ?? row.status}
          </Badge>
        </div>
        <p className="text-xs">
          <span className="font-medium">License scope: </span>
          {row.scope}
        </p>
        <div className="flex flex-wrap gap-2">
          {row.requiresMalpractice ? (
            <Badge variant={row.insured ? 'default' : 'destructive'}>
              Requires malpractice · {row.insured ? 'provider insured' : 'provider NOT insured'}
            </Badge>
          ) : (
            <Badge variant="outline">No malpractice required</Badge>
          )}
          {row.insured && (
            <Badge className="bg-green-600">
              <ShieldCheck data-icon="inline-start" /> Insured
            </Badge>
          )}
          {row.involvesMedicalProcedures && (
            <Badge variant={unlicensedProcedures ? 'destructive' : 'secondary'}>
              Prescribing / injectables / IVs
              {unlicensedProcedures ? ' — provider is not licensed' : ''}
            </Badge>
          )}
          {flagged.length > 0 && (
            <Badge variant="destructive">Flagged words: {flagged.join(', ')}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {row.description ? (
          <p className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            <Highlighted text={row.description} />
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No description.</p>
        )}

        <ul className="space-y-1">
          {REVIEW_CHECKS.map((c) => (
            <li key={c.key}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!checked[c.key]}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                />
                {c.label}
              </label>
            </li>
          ))}
        </ul>

        {row.publishBlockers.length > 0 && row.status !== 'published' && (
          <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Publishing will likely be blocked: {row.publishBlockers.join('; ')}.
          </p>
        )}

        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Review notes (required for Request changes; shown to the provider)"
        />

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {row.reviewedAt && (
            <span className="mr-auto text-xs text-muted-foreground">
              Last reviewed {formatDateTime(row.reviewedAt)}
            </span>
          )}
          {row.status !== 'paused' && (
            <Button variant="outline" size="sm" disabled={!!submitting} onClick={() => act('pause')}>
              {submitting === 'pause' ? (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              ) : (
                <Pause className="size-4" data-icon="inline-start" />
              )}
              Pause
            </Button>
          )}
          {row.status !== 'rejected' && (
            <Button
              variant="outline"
              size="sm"
              disabled={!!submitting}
              onClick={() => act('request_changes')}
            >
              {submitting === 'request_changes' ? (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              ) : (
                <Pencil className="size-4" data-icon="inline-start" />
              )}
              Request changes
            </Button>
          )}
          {row.status !== 'published' && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              disabled={!!submitting || !allChecked}
              title={allChecked ? undefined : 'Tick every review check first'}
              onClick={() => act('publish')}
            >
              {submitting === 'publish' ? (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              ) : (
                <CheckCircle className="size-4" data-icon="inline-start" />
              )}
              Publish
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ListingsClient({
  rows: initialRows,
  demo = false,
  loadError = null,
}: {
  rows: ListingRow[]
  demo?: boolean
  loadError?: string | null
}) {
  const [rows, setRows] = useState(initialRows)
  const [status, setStatus] = useState('pending_review')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])

  const visible = rows.filter((r) => r.status === status)

  function onUpdated(id: string, patch: Partial<ListingRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Listings review</h1>
          <p className="text-sm text-muted-foreground">
            Every listing is reviewed before it goes live.
          </p>
        </div>
        <Badge variant="secondary">{counts.pending_review ?? 0} awaiting review</Badge>
      </div>

      {demo && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Demo mode — sample listings, nothing is saved.
        </p>
      )}
      {loadError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              status === s
                ? 'border-[#1dbf73] bg-[#1dbf73]/10 text-[#108a50]'
                : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            {STATUS_LABEL[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No listings here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((r) => (
            <ListingCard key={r.id} row={r} demo={demo} onUpdated={onUpdated} />
          ))}
        </div>
      )}
    </div>
  )
}
