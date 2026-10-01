'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DocumentViewer } from '@/components/admin/document-viewer'
import { credentialDocumentHref } from '@/lib/credentials/document'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import {
  CATEGORY_LABEL,
  NAME_ON_ID_KEY,
  NAME_ON_MALPRACTICE_KEY,
  PRESSURE_TO_RUSH_KEY,
  SELF_DISCLOSURE_QUESTIONS,
  STATUS_BADGE,
  STATUS_LABEL,
  branchFor,
  checklistFor,
  daysUntil,
  formatDay,
  isPastDate,
  matchesAnyName,
  nppesUrl,
  type AdminChecklist,
  type ApplicantData,
  type ChecklistEntry,
  type EvidenceItem,
} from '../_lib/shared'
import { ChecklistItem, saveChecklistEntry } from './checklist-item'

type Action =
  | 'approve'
  | 'request_info'
  | 'reject'
  | 'suspend'
  | 'unsuspend'
  | 'mark_exclusion_screened'
  | 'verify_insurance'
  | 'clear_hold'

type DialogAction = 'approve' | 'request_info' | 'reject' | 'suspend' | 'unsuspend'

const DIALOG_COPY: Record<
  DialogAction,
  { title: string; description: string; placeholder: string; confirm: string; notesRequired: boolean }
> = {
  approve: {
    title: 'Approve provider',
    description:
      'Approval sets them live (or Insurance pending if their services need malpractice coverage they haven’t had reviewed) and sends the “You’re live on Sanus” email.',
    placeholder: 'Optional note for the provider’s notification',
    confirm: 'Approve',
    notesRequired: false,
  },
  request_info: {
    title: 'Needs info',
    description:
      'Describe what additional information or documents are needed. The provider is emailed this message.',
    placeholder: 'What do you need from the provider?',
    confirm: 'Send request',
    notesRequired: true,
  },
  reject: {
    title: 'Reject provider',
    description: 'Give the reason. The provider is emailed this message.',
    placeholder: 'Reason for rejection…',
    confirm: 'Reject',
    notesRequired: true,
  },
  suspend: {
    title: 'Suspend provider',
    description:
      'Their profile and listings are hidden and they cannot go live until unsuspended. The reason is kept on file (internal).',
    placeholder: 'Reason for suspension (internal)…',
    confirm: 'Suspend',
    notesRequired: true,
  },
  unsuspend: {
    title: 'Unsuspend provider',
    description:
      'Restores them to Approved, or Insurance pending if their services still need a reviewed malpractice certificate.',
    placeholder: 'Optional note (internal)',
    confirm: 'Unsuspend',
    notesRequired: false,
  },
}

const CHECK_LABELS: Record<string, string> = {
  medallion: 'Medallion',
  checkr: 'Checkr background check',
  stripe_identity: 'Stripe Identity',
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children ?? '—'}</dd>
    </div>
  )
}

function YesNo({ value }: { value: boolean | null | undefined }) {
  if (value === true) return <>Yes</>
  if (value === false) return <>No</>
  return <span className="text-muted-foreground">Not answered</span>
}

function list(values: string[] | null | undefined): string {
  return values && values.length ? values.join(', ') : '—'
}

function DateWithExpiry({ date }: { date: string | null }) {
  if (!date) return <>—</>
  const expired = isPastDate(date)
  const days = daysUntil(date)
  return (
    <span className={cn(expired && 'font-semibold text-destructive')}>
      {formatDay(date)}
      {expired ? (
        <Badge variant="destructive" className="ml-2">
          Expired
        </Badge>
      ) : days !== null && days <= 60 ? (
        <Badge variant="secondary" className="ml-2">
          {days}d left
        </Badge>
      ) : null}
    </span>
  )
}

export function ApplicantClient({ data, demo = false }: { data: ApplicantData; demo?: boolean }) {
  const router = useRouter()
  const { profile, credentials, checks, offerings, duplicates } = data
  const id = profile.id

  const [checklist, setChecklist] = useState<AdminChecklist>(profile.admin_checklist ?? {})
  const [evidence, setEvidence] = useState<EvidenceItem[]>(data.evidence)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(
    credentials.find((c) => c.has_document)?.id ?? null
  )
  const [dialog, setDialog] = useState<DialogAction | null>(null)
  const [dialogNotes, setDialogNotes] = useState('')
  const [submitting, setSubmitting] = useState<Action | null>(null)
  const [runningCheck, setRunningCheck] = useState<string | null>(null)
  const [nameOnId, setNameOnId] = useState(profile.admin_checklist?.[NAME_ON_ID_KEY]?.note ?? '')
  const [nameOnMalpractice, setNameOnMalpractice] = useState(
    profile.admin_checklist?.[NAME_ON_MALPRACTICE_KEY]?.note ?? ''
  )
  const [rushNote, setRushNote] = useState(
    profile.admin_checklist?.[PRESSURE_TO_RUSH_KEY]?.note ?? ''
  )

  const status = profile.verification_status
  const isOther = profile.professional_category === 'other'
  const branch = branchFor(profile.professional_category, profile.credential_basis)
  const credentialed = branch === 'clinical' || branch === 'allied'
  const profileName = `${profile.first_name} ${profile.last_name}`.trim()
  const malpracticeCreds = credentials.filter((c) => c.credential_type === 'malpractice_insurance')

  const items = useMemo(
    () =>
      checklistFor({
        branch,
        isOther,
        npi: profile.npi_number,
        needsMalpractice: !!profile.offers_high_risk_services,
        carriesInsurance: !!profile.carries_liability_insurance || malpracticeCreds.length > 0,
      }),
    [
      branch,
      isOther,
      profile.npi_number,
      profile.offers_high_risk_services,
      profile.carries_liability_insurance,
      malpracticeCreds.length,
    ]
  )

  const evidenceByKey = useMemo(() => {
    const m = new Map<string, EvidenceItem[]>()
    for (const e of evidence) m.set(e.check_key, [...(m.get(e.check_key) ?? []), e])
    return m
  }, [evidence])

  const doneCount = items.filter((i) => checklist[i.key]?.done).length
  const missingEvidence = items.filter(
    (i) => i.needsEvidence && checklist[i.key]?.done && !(evidenceByKey.get(i.key)?.length)
  )

  /* ───────────── Red flags ───────────── */

  const redFlags: { label: string; detail?: string; severe?: boolean }[] = []
  {
    const legalVsProfile = matchesAnyName(profileName, profile.legal_name, profile.other_names)
    if (legalVsProfile === false) {
      redFlags.push({
        label: 'Name mismatch: account name vs legal name',
        detail: `Account “${profileName}” · legal “${profile.legal_name}”${profile.other_names ? ` · other names “${profile.other_names}”` : ''}`,
        severe: true,
      })
    }
    const recordedId = checklist[NAME_ON_ID_KEY]?.note
    if (recordedId && matchesAnyName(recordedId, profile.legal_name ?? profileName, profile.other_names) === false) {
      redFlags.push({
        label: 'Name mismatch: government ID',
        detail: `ID “${recordedId}” · legal “${profile.legal_name ?? profileName}”`,
        severe: true,
      })
    }
    const recordedMal = checklist[NAME_ON_MALPRACTICE_KEY]?.note
    if (recordedMal && matchesAnyName(recordedMal, profile.legal_name ?? profileName, profile.other_names) === false) {
      redFlags.push({
        label: 'Name mismatch: malpractice certificate',
        detail: `Certificate “${recordedMal}” · legal “${profile.legal_name ?? profileName}”`,
        severe: true,
      })
    }
    if (isPastDate(profile.license_expiration_date)) {
      redFlags.push({
        label: 'License expired',
        detail: `Expired ${formatDay(profile.license_expiration_date)}`,
        severe: true,
      })
    }
    for (const c of credentials) {
      if (c.status === 'rejected') continue
      if (isPastDate(c.expiration_date) || c.status === 'expired') {
        redFlags.push({
          label: `Expired document: ${c.name}`,
          detail: c.expiration_date ? `Expired ${formatDay(c.expiration_date)}` : undefined,
          severe: true,
        })
      }
    }
    for (const q of SELF_DISCLOSURE_QUESTIONS) {
      if (profile.self_disclosures?.[q.key]?.answer === true) {
        redFlags.push({ label: `Disclosed “yes”: ${q.label}` })
      }
    }
    if (duplicates && duplicates.length > 0) {
      for (const d of duplicates) {
        redFlags.push({
          label: `Same ${d.kind.replace(/_/g, ' ')} as another account`,
          detail: d.other_name ?? d.other_contractor,
          severe: true,
        })
      }
    }
    if (checklist[PRESSURE_TO_RUSH_KEY]?.done) {
      redFlags.push({
        label: 'Pressure to rush',
        detail: checklist[PRESSURE_TO_RUSH_KEY]?.note ?? undefined,
        severe: true,
      })
    }
    if (credentialed && (!profile.attested_accurate_at || !profile.authorized_checks_at)) {
      redFlags.push({ label: 'Attestation / authorization checkbox missing' })
    }
  }

  /* ───────────── Mutations ───────────── */

  function onChecklistSaved(key: string, entry: ChecklistEntry) {
    setChecklist((prev) => ({ ...prev, [key]: entry }))
  }

  async function saveSpecial(key: string, done: boolean, note: string) {
    if (demo) {
      onChecklistSaved(key, { done, note: note.trim() || null, at: new Date().toISOString() })
      toast.info('Demo mode — not saved')
      return
    }
    try {
      onChecklistSaved(key, await saveChecklistEntry(id, key, done, note.trim() || null))
      toast.success('Saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function post(action: Action, extra: Record<string, unknown> = {}) {
    if (demo) {
      toast.info('Demo mode — nothing is saved')
      return false
    }
    setSubmitting(action)
    try {
      const res = await fetch(`/api/admin/verification/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Request failed')
      for (const w of body.warnings ?? []) toast.warning(w)
      toast.success(
        body.status && body.status !== status
          ? `Saved — status is now ${STATUS_LABEL[body.status] ?? body.status}`
          : 'Saved'
      )
      router.refresh()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
      return false
    } finally {
      setSubmitting(null)
    }
  }

  function openDialog(action: DialogAction) {
    if (action === 'approve') {
      const open = items.length - doneCount
      const warnings: string[] = []
      if (open > 0) warnings.push(`${open} checklist item(s) are not done.`)
      if (missingEvidence.length > 0)
        warnings.push(`${missingEvidence.length} lookup(s) have no screenshot/PDF.`)
      if (redFlags.some((f) => f.severe)) warnings.push('There are open red flags.')
      if (warnings.length && !window.confirm(`${warnings.join('\n')}\n\nApprove anyway?`)) return
    }
    setDialogNotes('')
    setDialog(action)
  }

  async function confirmDialog() {
    if (!dialog) return
    const copy = DIALOG_COPY[dialog]
    if (copy.notesRequired && !dialogNotes.trim()) return
    const ok = await post(dialog, { notes: dialogNotes.trim() || undefined })
    if (ok || demo) setDialog(null)
  }

  async function runCheck(checkType: string) {
    if (demo) {
      toast.info('Demo mode — checks are not run')
      return
    }
    setRunningCheck(checkType)
    try {
      const res = await fetch(`/api/admin/verification/${id}/checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkType }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Failed to run check')
      toast.success(`${CHECK_LABELS[checkType]} updated`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run check')
    } finally {
      setRunningCheck(null)
    }
  }

  const selectedDoc = credentials.find((c) => c.id === selectedDocId) ?? null
  const insuranceDays = daysUntil(profile.insurance_due_at)
  const canApprove = ['pending_review', 'more_info_requested', 'rejected'].includes(status)
  const canRequestInfo = ['pending_review', 'more_info_requested'].includes(status)
  const canReject = ['pending_review', 'more_info_requested', 'not_submitted'].includes(status)
  const canSuspend = !['suspended', 'rejected', 'not_submitted'].includes(status)
  const isLive = status === 'approved' || status === 'insurance_pending'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/admin/verification" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{profileName || 'Unnamed provider'}</h1>
            <Badge variant={STATUS_BADGE[status] ?? 'secondary'}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
            {isOther ? (
              <Badge variant="outline" className="border-amber-400 text-amber-700">
                Other: {profile.other_profession || '(not given)'}
              </Badge>
            ) : (
              <Badge variant="outline">
                {CATEGORY_LABEL[profile.professional_category ?? ''] ?? profile.contractor_type ?? '—'}
              </Badge>
            )}
            {profile.insured_verified_at && (
              <Badge className="bg-green-600">
                <ShieldCheck data-icon="inline-start" /> Insured
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.email ?? 'no email'} · {profile.phone ?? 'no phone'}
            {profile.city && profile.state ? ` · ${profile.city}, ${profile.state}` : ''}
            {profile.onboarding_completed_at
              ? ` · submitted ${formatDateTime(profile.onboarding_completed_at)}`
              : ''}
          </p>
          {isOther && (
            <p className="mt-1 text-xs text-amber-700">
              Other applicant — question set: {branch ?? 'unknown'} (credential basis:{' '}
              {profile.credential_basis ?? 'not given'}). Decide fit before approving.
            </p>
          )}
        </div>
      </div>

      {demo && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Demo mode — sample applicant, nothing is saved.
        </p>
      )}

      {profile.verification_notes && (
        <Card>
          <CardContent className="py-3 text-sm">
            <span className="font-medium">Last review note: </span>
            {profile.verification_notes}
            {profile.verification_reviewed_at && (
              <span className="text-muted-foreground">
                {' '}
                ({formatDateTime(profile.verification_reviewed_at)})
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Red flags */}
      <Card className={cn(redFlags.length > 0 && 'border-destructive/50')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle
              className={cn('size-4', redFlags.length ? 'text-destructive' : 'text-muted-foreground')}
            />
            Red flags ({redFlags.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {redFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No automatic red flags.</p>
          ) : (
            <ul className="space-y-1">
              {redFlags.map((f, i) => (
                <li key={i} className="text-sm">
                  <span className={cn('font-medium', f.severe && 'text-destructive')}>{f.label}</span>
                  {f.detail && <span className="text-muted-foreground"> — {f.detail}</span>}
                </li>
              ))}
            </ul>
          )}
          {duplicates === null && (
            <p className="text-xs text-muted-foreground">
              Duplicate phone/payout check is unavailable right now.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Also check manually: edited-looking documents, license not active and clear, not found on the
            board site.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Name on government ID (as printed)</Label>
              <div className="flex gap-2">
                <Input value={nameOnId} onChange={(e) => setNameOnId(e.target.value)} className="h-8" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveSpecial(NAME_ON_ID_KEY, !!nameOnId.trim(), nameOnId)}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name on malpractice certificate</Label>
              <div className="flex gap-2">
                <Input
                  value={nameOnMalpractice}
                  onChange={(e) => setNameOnMalpractice(e.target.value)}
                  className="h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    saveSpecial(NAME_ON_MALPRACTICE_KEY, !!nameOnMalpractice.trim(), nameOnMalpractice)
                  }
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pressure to rush (what happened)</Label>
              <div className="flex gap-2">
                <Input value={rushNote} onChange={(e) => setRushNote(e.target.value)} className="h-8" />
                <Button
                  size="sm"
                  variant={checklist[PRESSURE_TO_RUSH_KEY]?.done ? 'outline' : 'destructive'}
                  onClick={() =>
                    saveSpecial(PRESSURE_TO_RUSH_KEY, !checklist[PRESSURE_TO_RUSH_KEY]?.done, rushNote)
                  }
                >
                  {checklist[PRESSURE_TO_RUSH_KEY]?.done ? 'Clear' : 'Flag'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Application (step 3) */}
      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(branch === 'clinical' || branch === 'allied') && (
              <>
                <Field
                  label={
                    branch === 'clinical'
                      ? 'Legal name (as on license)'
                      : 'Name (as on certification)'
                  }
                >
                  {profile.legal_name ?? '—'}
                </Field>
                <Field label="Other names used">{profile.other_names || '—'}</Field>
              </>
            )}
            {isOther && <Field label="Typed profession">{profile.other_profession ?? '—'}</Field>}

            {branch === 'clinical' && (
              <>
                <Field label="Profession / license type">{profile.license_type ?? '—'}</Field>
                <Field label="Specialty">{profile.specialties?.[0] ?? '—'}</Field>
                <Field label="License number">{profile.state_license_number ?? '—'}</Field>
                <Field label="License issued">{formatDay(profile.license_issue_date)}</Field>
                <Field label="License expires">
                  <DateWithExpiry date={profile.license_expiration_date} />
                </Field>
                <Field label="Licensing state(s)">{list(profile.license_states)}</Field>
                <Field label="Compact license">
                  <YesNo value={profile.has_compact_license} />
                </Field>
                <Field label="Telehealth client states">{list(profile.telehealth_states)}</Field>
                <Field label="NPI">
                  {profile.npi_number ? (
                    <a
                      href={nppesUrl(profile.npi_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#1dbf73] hover:underline"
                    >
                      {profile.npi_number} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    'Not given'
                  )}
                </Field>
                <Field label="Years in practice">{profile.years_of_experience ?? '—'}</Field>
              </>
            )}

            {branch === 'allied' && (
              <>
                <Field label="Certification type">{profile.certification_type ?? '—'}</Field>
                <Field label="Certifying organization">
                  {profile.certifying_organization ?? '—'}
                </Field>
                <Field label="Specialty / focus">{profile.specialties?.[0] ?? '—'}</Field>
                <Field label="Years of experience">{profile.years_of_experience ?? '—'}</Field>
              </>
            )}

            {branch === 'consultant' && (
              <>
                <Field label="Consulting specialty">{profile.specialties?.[0] ?? '—'}</Field>
                <Field label="Who they work with">{list(profile.client_types)}</Field>
                <Field label="Years of experience">{profile.years_of_experience ?? '—'}</Field>
                <Field label="LinkedIn / website">
                  {profile.website_url ? (
                    <a
                      href={profile.website_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 break-all text-[#1dbf73] hover:underline"
                    >
                      {profile.website_url} <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    '—'
                  )}
                </Field>
                <Field label="Short background" className="sm:col-span-2 lg:col-span-3">
                  {profile.consulting_background ?? '—'}
                </Field>
              </>
            )}

            {branch === 'educator' && (
              <>
                <Field label="Primary professional background">
                  {profile.primary_background ?? '—'}
                </Field>
                <Field label="What they teach">{profile.teaching_topics ?? '—'}</Field>
                <Field label="Who they teach">{list(profile.client_types)}</Field>
                <Field label="Accredited CEU/CME">{profile.ceu_accreditation ?? '—'}</Field>
              </>
            )}
          </dl>

          {credentialed && (
            <div className="space-y-3 border-t pt-4">
              <Field label="Practice question: in-person / hands-on care, home visits, prescribing, injectables, or IVs?">
                <span className={cn(profile.offers_high_risk_services && 'font-semibold')}>
                  <YesNo value={profile.offers_high_risk_services} />
                  {profile.offers_high_risk_services && ' — malpractice coverage required'}
                </span>
              </Field>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Self-disclosures</p>
                <ul className="space-y-2">
                  {SELF_DISCLOSURE_QUESTIONS.map((q) => {
                    const d = profile.self_disclosures?.[q.key]
                    const yes = d?.answer === true
                    return (
                      <li
                        key={q.key}
                        className={cn(
                          'rounded-md border px-3 py-2 text-sm',
                          yes && 'border-destructive/50 bg-destructive/5'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span>{q.label}</span>
                          <span className={cn('shrink-0 font-semibold', yes && 'text-destructive')}>
                            <YesNo value={d?.answer} />
                          </span>
                        </div>
                        {yes && (
                          <p className="mt-1 text-sm whitespace-pre-wrap">
                            <span className="font-medium">Explanation: </span>
                            {d?.details || <em className="text-destructive">none given</em>}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}

          <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Carries professional liability insurance">
              {profile.carries_liability_insurance === false && profile.offers_high_risk_services ? (
                <span className="font-medium text-amber-700">No, but required</span>
              ) : profile.carries_liability_insurance === false ? (
                'No, not required'
              ) : (
                <YesNo value={profile.carries_liability_insurance} />
              )}
            </Field>
            <Field label="Certified information accurate">
              {profile.attested_accurate_at ? formatDateTime(profile.attested_accurate_at) : 'Not attested'}
            </Field>
            <Field label="Authorized credential & exclusion checks">
              {profile.authorized_checks_at ? formatDateTime(profile.authorized_checks_at) : 'Not authorized'}
            </Field>
            {profile.approved_at && <Field label="Approved">{formatDateTime(profile.approved_at)}</Field>}
            {profile.insurance_due_at && (
              <Field label="Insurance due">
                <span
                  className={cn(
                    insuranceDays !== null && insuranceDays < 0 && 'font-semibold text-destructive'
                  )}
                >
                  {formatDateTime(profile.insurance_due_at)}
                  {insuranceDays !== null &&
                    (insuranceDays < 0 ? ` (overdue ${-insuranceDays}d)` : ` (${insuranceDays}d left)`)}
                </span>
              </Field>
            )}
            {profile.insured_verified_at && (
              <Field label="Insurance verified">{formatDateTime(profile.insured_verified_at)}</Field>
            )}
            {profile.compliance_hold_reason && (
              <Field label="Compliance hold">
                <span className="text-destructive">{profile.compliance_hold_reason}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  disabled={!!submitting}
                  onClick={() => post('clear_hold')}
                >
                  {submitting === 'clear_hold' && (
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  )}
                  Clear hold
                </Button>
              </Field>
            )}
            <Field label="Agreement accepted">
              {profile.contractor_agreement_accepted_at
                ? formatDateTime(profile.contractor_agreement_accepted_at)
                : 'Not yet'}
            </Field>
          </dl>
        </CardContent>
      </Card>

      {/* Documents */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {credentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded.</p>
            ) : (
              credentials.map((doc) => {
                const expired = isPastDate(doc.expiration_date)
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      doc.id === selectedDocId
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{doc.name}</span>
                      <Badge variant={doc.status === 'verified' ? 'default' : 'outline'}>
                        {doc.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="mt-1 pl-6 text-xs text-muted-foreground">
                      Uploaded {formatDateTime(doc.created_at)}
                      {doc.expiration_date && (
                        <span className={cn(expired && 'font-semibold text-destructive')}>
                          {' '}
                          · {expired ? 'expired' : 'expires'} {formatDay(doc.expiration_date)}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="h-125">
            <DocumentViewer
              documentUrl={
                !demo && selectedDoc?.has_document ? credentialDocumentHref(selectedDoc.id) : null
              }
              filename={selectedDoc?.document_filename ?? null}
            />
          </CardContent>
        </Card>
      </div>

      {/* Malpractice */}
      {(malpracticeCreds.length > 0 || profile.offers_high_risk_services) && (
        <Card>
          <CardHeader>
            <CardTitle>Malpractice coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {malpracticeCreds.length === 0 ? (
              <p className="text-sm text-amber-700">
                No certificate uploaded. Approval will place them in Insurance pending with a deadline.
              </p>
            ) : (
              malpracticeCreds.map((c) => {
                const expired = isPastDate(c.expiration_date)
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-end justify-between gap-3 rounded-md border p-3"
                  >
                    <dl className="grid flex-1 gap-3 sm:grid-cols-4">
                      <Field label="Carrier">{c.issuing_authority ?? '—'}</Field>
                      <Field label="Policy number">{c.license_number ?? '—'}</Field>
                      <Field label="Coverage amount">{c.coverage_amount ?? '—'}</Field>
                      <Field label="Expires">
                        <DateWithExpiry date={c.expiration_date} />
                      </Field>
                    </dl>
                    {c.status === 'verified' && profile.insured_verified_at ? (
                      <Badge className="bg-green-600">
                        Verified {c.verified_at ? formatDay(c.verified_at) : ''}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!!submitting || expired || c.status === 'rejected'}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Confirm the certificate is current, the insured name matches, and it covers the services offered.'
                            )
                          ) {
                            post('verify_insurance', { credentialId: c.id })
                          }
                        }}
                      >
                        {submitting === 'verify_insurance' ? (
                          <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                        ) : (
                          <ShieldCheck className="size-4" data-icon="inline-start" />
                        )}
                        Verify certificate
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Manual review checklist
            <Badge variant={doneCount === items.length ? 'default' : 'secondary'}>
              {doneCount}/{items.length} done
            </Badge>
            {missingEvidence.length > 0 && (
              <Badge variant="destructive">{missingEvidence.length} missing evidence</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Keep a screenshot or PDF of every lookup — the capture date is recorded on upload.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {items.map((def) => (
              <ChecklistItem
                key={def.key}
                contractorId={id}
                def={def}
                entry={checklist[def.key]}
                evidence={evidenceByKey.get(def.key) ?? []}
                adminNames={data.adminNames}
                demo={demo}
                onSaved={onChecklistSaved}
                onEvidence={(e) => setEvidence((prev) => [e, ...prev])}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Ongoing exclusion screening */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="text-sm">
            <span className="font-medium">Exclusion screening (OIG, SAM.gov, Medi-Cal): </span>
            {profile.last_exclusion_check_at
              ? `last done ${formatDateTime(profile.last_exclusion_check_at)}`
              : 'never recorded'}
            {isLive && (
              <span className="text-muted-foreground"> · re-run monthly while live</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!!submitting}
            onClick={() => post('mark_exclusion_screened')}
          >
            {submitting === 'mark_exclusion_screened' ? (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            ) : (
              <CheckCircle className="size-4" data-icon="inline-start" />
            )}
            Mark exclusion screening done
          </Button>
        </CardContent>
      </Card>

      {/* Listings */}
      {offerings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Listings ({offerings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {offerings.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{o.title}</span>
                  <Badge variant="outline">{o.status.replace(/_/g, ' ')}</Badge>
                  {o.format && <span className="text-xs text-muted-foreground">{o.format}</span>}
                  {o.requires_malpractice && <Badge variant="secondary">needs malpractice</Badge>}
                </li>
              ))}
            </ul>
            <Link href="/admin/listings" className="mt-2 inline-block text-xs text-[#1dbf73] hover:underline">
              Open listings review →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Third-party checks (legacy integrations) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(['medallion', 'checkr', 'stripe_identity'] as const).map((type) => {
          const check = checks.find((c) => c.check_type === type) ?? null
          return (
            <Card key={type}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{CHECK_LABELS[type]}</CardTitle>
                <Badge variant={check?.status === 'failed' ? 'destructive' : 'outline'}>
                  {(check?.status ?? 'not_started').replace(/_/g, ' ')}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {check?.result_summary && (
                  <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                    {JSON.stringify(check.result_summary, null, 2)}
                  </pre>
                )}
                {check?.checked_at && (
                  <p className="text-xs text-muted-foreground">
                    Checked {formatDateTime(check.checked_at)}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="xs"
                  disabled={runningCheck === type}
                  onClick={() => runCheck(type)}
                >
                  {runningCheck === type ? (
                    <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
                  ) : (
                    <RefreshCw className="size-3" data-icon="inline-start" />
                  )}
                  {check ? 'Refresh' : 'Run check'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Actions */}
      <Card className="sticky bottom-2 z-10 shadow-md">
        <CardContent className="flex flex-wrap items-center justify-end gap-2 py-3">
          <span className="mr-auto text-xs text-muted-foreground">
            Checklist {doneCount}/{items.length}
            {redFlags.length > 0 ? ` · ${redFlags.length} red flag(s)` : ''}
          </span>
          {canSuspend && (
            <Button variant="outline" disabled={!!submitting} onClick={() => openDialog('suspend')}>
              <Ban className="size-4" data-icon="inline-start" />
              Suspend
            </Button>
          )}
          {status === 'suspended' && (
            <Button variant="outline" disabled={!!submitting} onClick={() => openDialog('unsuspend')}>
              <RotateCcw className="size-4" data-icon="inline-start" />
              Unsuspend
            </Button>
          )}
          {canRequestInfo && (
            <Button variant="outline" disabled={!!submitting} onClick={() => openDialog('request_info')}>
              <MessageCircleQuestion className="size-4" data-icon="inline-start" />
              Needs info
            </Button>
          )}
          {canReject && (
            <Button variant="destructive" disabled={!!submitting} onClick={() => openDialog('reject')}>
              <XCircle className="size-4" data-icon="inline-start" />
              Reject
            </Button>
          )}
          {canApprove && (
            <Button
              disabled={!!submitting}
              onClick={() => openDialog('approve')}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="size-4" data-icon="inline-start" />
              Approve
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>{DIALOG_COPY[dialog].title}</DialogTitle>
                <DialogDescription>{DIALOG_COPY[dialog].description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="dialog-notes">
                  {DIALOG_COPY[dialog].notesRequired ? 'Message (required)' : 'Message'}
                </Label>
                <Textarea
                  id="dialog-notes"
                  value={dialogNotes}
                  onChange={(e) => setDialogNotes(e.target.value)}
                  rows={4}
                  placeholder={DIALOG_COPY[dialog].placeholder}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant={dialog === 'reject' || dialog === 'suspend' ? 'destructive' : 'default'}
                  disabled={
                    !!submitting || (DIALOG_COPY[dialog].notesRequired && !dialogNotes.trim())
                  }
                  onClick={confirmDialog}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
                  {DIALOG_COPY[dialog].confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
