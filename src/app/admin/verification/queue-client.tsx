'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import {
  CATEGORY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  VERIFICATION_STATUSES,
  daysUntil,
} from './_lib/shared'

export interface QueueRow {
  id: string
  name: string
  email: string | null
  category: string | null
  otherProfession: string | null
  credentialBasis: string | null
  status: string
  updatedAt: string
  disclosuresYes: string[]
  /** null = duplicate check unavailable */
  duplicateCount: number | null
  rescreenDue: boolean
  lastExclusionCheckAt: string | null
  insuranceDueAt: string | null
}

type StatusFilter = 'open' | 'all' | (typeof VERIFICATION_STATUSES)[number]
type FlagFilter = 'other' | 'disclosure' | 'duplicate' | 'rescreen' | 'insurance'

const OPEN_STATUSES = ['pending_review', 'more_info_requested']

const FLAG_LABEL: Record<FlagFilter, string> = {
  other: 'Other profession',
  disclosure: 'Disclosed “yes”',
  duplicate: 'Duplicate phone/payout',
  rescreen: 'Re-screen due',
  insurance: 'Insurance deadline',
}

function matchesFlag(row: QueueRow, flag: FlagFilter): boolean {
  switch (flag) {
    case 'other':
      return row.category === 'other'
    case 'disclosure':
      return row.disclosuresYes.length > 0
    case 'duplicate':
      return (row.duplicateCount ?? 0) > 0
    case 'rescreen':
      return row.rescreenDue
    case 'insurance':
      return row.status === 'insurance_pending'
  }
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-[#1dbf73] bg-[#1dbf73]/10 text-[#108a50]'
          : 'border-border text-muted-foreground hover:bg-muted'
      )}
    >
      {children}
    </button>
  )
}

export function QueueClient({
  rows,
  rescreenDays,
  demo = false,
  loadError = null,
}: {
  rows: QueueRow[]
  rescreenDays: number
  demo?: boolean
  loadError?: string | null
}) {
  const [status, setStatus] = useState<StatusFilter>('open')
  const [flags, setFlags] = useState<FlagFilter[]>([])
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])

  const flagCounts = useMemo(() => {
    const c = {} as Record<FlagFilter, number>
    for (const f of Object.keys(FLAG_LABEL) as FlagFilter[]) {
      c[f] = rows.filter((r) => matchesFlag(r, f)).length
    }
    return c
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status === 'open' && !OPEN_STATUSES.includes(r.status)) return false
      if (status !== 'open' && status !== 'all' && r.status !== status) return false
      if (!flags.every((f) => matchesFlag(r, f))) return false
      if (q) {
        const hay = `${r.name} ${r.email ?? ''} ${r.otherProfession ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, status, flags, query])

  function toggleFlag(f: FlagFilter) {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))
  }

  const openCount = rows.filter((r) => OPEN_STATUSES.includes(r.status)).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Provider applications</h1>
          <p className="text-sm text-muted-foreground">
            Review applicants, re-screen live providers every {rescreenDays} days, and track
            insurance deadlines.
          </p>
        </div>
        <Badge variant="secondary">{openCount} awaiting review</Badge>
      </div>

      {demo && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Demo mode — sample applicants, nothing is saved.
        </p>
      )}
      {loadError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={status === 'open'} onClick={() => setStatus('open')}>
              Needs action ({openCount})
            </Chip>
            {VERIFICATION_STATUSES.map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {STATUS_LABEL[s]} ({counts[s] ?? 0})
              </Chip>
            ))}
            <Chip active={status === 'all'} onClick={() => setStatus('all')}>
              All ({rows.length})
            </Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Flags:</span>
            {(Object.keys(FLAG_LABEL) as FlagFilter[]).map((f) => (
              <Chip key={f} active={flags.includes(f)} onClick={() => toggleFlag(f)}>
                {FLAG_LABEL[f]} ({flagCounts[f]})
              </Chip>
            ))}
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, profession"
              className="ml-auto h-8 w-full max-w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="sr-only">Applicants</CardTitle>
          {visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No applicants match these filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Insurance deadline</TableHead>
                  <TableHead>Last updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => {
                  const days = daysUntil(r.insuranceDueAt)
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/admin/verification/${r.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.email ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.category === 'other' ? (
                          <div>
                            <Badge variant="outline" className="border-amber-400 text-amber-700">
                              Other
                            </Badge>
                            <div className="mt-1 max-w-48 truncate text-xs font-medium">
                              {r.otherProfession || '(profession not given)'}
                            </div>
                            {r.credentialBasis && (
                              <div className="text-xs text-muted-foreground">
                                basis: {r.credentialBasis}
                              </div>
                            )}
                          </div>
                        ) : (
                          CATEGORY_LABEL[r.category ?? ''] ?? r.category ?? '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[r.status] ?? 'secondary'}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-64 flex-wrap gap-1">
                          {r.disclosuresYes.length > 0 && (
                            <Badge variant="destructive">
                              Disclosed yes ({r.disclosuresYes.length})
                            </Badge>
                          )}
                          {(r.duplicateCount ?? 0) > 0 && (
                            <Badge variant="destructive">Duplicate ({r.duplicateCount})</Badge>
                          )}
                          {r.duplicateCount === null && (
                            <Badge variant="outline" title="provider_duplicate_flags unavailable">
                              Dup check n/a
                            </Badge>
                          )}
                          {r.rescreenDue && (
                            <Badge
                              variant="secondary"
                              title={
                                r.lastExclusionCheckAt
                                  ? `Last screened ${formatDate(r.lastExclusionCheckAt)}`
                                  : 'Never screened'
                              }
                            >
                              Re-screen due
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.status === 'insurance_pending' && r.insuranceDueAt ? (
                          <span
                            className={cn(
                              days !== null && days < 0
                                ? 'font-semibold text-destructive'
                                : days !== null && days <= 7
                                  ? 'font-medium text-amber-700'
                                  : ''
                            )}
                          >
                            {formatDate(r.insuranceDueAt)}
                            {days !== null &&
                              (days < 0 ? ` (overdue ${-days}d)` : ` (${days}d left)`)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(r.updatedAt)}
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
