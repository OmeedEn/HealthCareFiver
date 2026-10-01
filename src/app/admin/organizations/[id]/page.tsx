import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/utils/format'
import { EVIDENCE_BUCKET } from '@/app/api/admin/verification/_lib/evidence'
import {
  ORG_ALLOWED_DECISIONS,
  ORG_CHECKLIST,
  ORG_DECISION_LABEL,
  ORG_DECISION_NEEDS_NOTE,
  ORG_RED_FLAGS,
  ORG_STATUS_BADGE,
  ORG_STATUS_LABEL,
  checklistProgress,
  isOrgStatus,
  type OrgChecklist,
  type OrgStatus,
} from '@/lib/org/review'
import { detectOrgRedFlags } from '@/lib/org/red-flags'
import { CREDENTIALS_BUCKET } from '@/lib/credentials/document'
import {
  BUSINESS_STRUCTURES,
  ORG_DISCLOSURES,
  ORG_DOCUMENT_KINDS,
  ORG_INTENTS,
  orgTypeLabel,
} from '@/lib/onboarding/organization'
import { addEvidence, decideOrganization, setChecklistItem } from '../actions'

export const dynamic = 'force-dynamic'

interface EvidenceRow {
  id: string
  check_key: string
  storage_path: string | null
  note: string | null
  created_at: string
}

const DETAIL_FIELDS: [string, string][] = [
  ['org_type', 'Type'],
  ['org_size', 'Size'],
  ['description', 'Description'],
  ['website', 'Website'],
  ['phone', 'Organization phone'],
  ['city', 'City'],
  ['state', 'State'],
  ['zip_code', 'ZIP'],
  ['location_count', 'Locations'],
  ['contact_name', 'Contact'],
  ['contact_title', 'Contact title'],
]

const VERIFY_FIELDS: [string, string][] = [
  ['legal_name', 'Legal business name'],
  ['business_structure', 'Business structure'],
  ['registration_state', 'State of registration'],
  ['has_facility_license', 'Holds a facility license'],
  ['facility_license_type', 'License type'],
  ['facility_license_number', 'License number'],
  ['facility_license_agency', 'Issuing agency'],
  ['facility_license_expires', 'License expires'],
  ['org_npi', 'Organization NPI'],
  ['ein', 'EIN'],
  ['attested_authorized_at', 'Attested authorized & accurate'],
  ['authorized_checks_at', 'Authorized verification & screening'],
]

function display(org: Record<string, unknown>, key: string): string {
  const v = org[key]
  if (v === null || v === undefined || v === '') return '—'
  if (key === 'org_type') return orgTypeLabel(String(v), org.org_type_other as string | null) ?? '—'
  if (key === 'business_structure') return BUSINESS_STRUCTURES.find((b) => b.value === v)?.label ?? String(v)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (key.endsWith('_at')) return formatDateTime(String(v))
  return String(v)
}

export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { db } = await requireAdmin()
  const { id } = await params

  const [{ data: org }, { data: account }, { data: evidenceRows }, { count: draftCount }, { data: orgDocs }] =
    await Promise.all([
      db.from('facility_profiles').select('*').eq('id', id).maybeSingle(),
      db.from('profiles').select('email, phone, created_at').eq('id', id).maybeSingle(),
      db
        .from('org_verification_evidence')
        .select('id, check_key, storage_path, note, created_at')
        .eq('facility_id', id)
        .order('created_at', { ascending: false }),
      db.from('jobs').select('id', { count: 'exact', head: true }).eq('facility_id', id),
      db
        .from('org_documents')
        .select('id, kind, filename, storage_path, uploaded_at')
        .eq('facility_id', id)
        .order('uploaded_at'),
    ])
  if (!org) notFound()

  const status: OrgStatus = isOrgStatus(org.verification_status) ? org.verification_status : 'pending_review'
  const checklist = (org.admin_checklist ?? {}) as OrgChecklist
  const progress = checklistProgress(checklist)
  const flags = detectOrgRedFlags({ email: account?.email ?? null, website: org.website })

  // Short-lived links to evidence files in the private bucket.
  const evidence = (evidenceRows ?? []) as EvidenceRow[]
  const signed = new Map<string, string>()
  await Promise.all(
    evidence
      .filter((e) => e.storage_path)
      .map(async (e) => {
        const { data } = await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(e.storage_path!, 600)
        if (data?.signedUrl) signed.set(e.id, data.signedUrl)
      })
  )

  const docLinks = new Map<string, string>()
  await Promise.all(
    (orgDocs ?? []).map(async (d) => {
      const { data } = await db.storage.from(CREDENTIALS_BUCKET).createSignedUrl(d.storage_path, 600)
      if (data?.signedUrl) docLinks.set(d.id, data.signedUrl)
    })
  )
  const disclosures = (org.self_disclosures ?? {}) as Record<string, { answer?: boolean; details?: string | null }>
  const intents = (org.intents ?? []) as string[]

  return (
    <div className="space-y-6">
      <Link href="/admin/organizations" className="text-sm text-[#62646a] hover:text-[#1dbf73]">
        &larr; All organizations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">{org.facility_name || 'Unnamed organization'}</h1>
          <p className="text-sm text-[#62646a]">
            {account?.email} · signed up {account?.created_at ? formatDateTime(account.created_at) : '—'}
          </p>
        </div>
        <Badge variant={ORG_STATUS_BADGE[status]} className="text-sm">
          {ORG_STATUS_LABEL[status]}
        </Badge>
      </div>

      {!org.onboarding_submitted_at && (
        <Card className="border-[#f5deb3] bg-[#fdf6e3]">
          <CardContent className="pt-6 text-sm text-[#404145]">
            <span className="font-semibold">Application not submitted yet.</span> They&apos;re on step{' '}
            {org.onboarding_step ?? 2} of 4 of signup. Review once they submit.
          </CardContent>
        </Card>
      )}

      {org.verification_notes && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <span className="font-semibold">Last note to the organization:</span>{' '}
            <span className="whitespace-pre-line">{org.verification_notes}</span>
            {org.verification_reviewed_at && (
              <span className="text-[#62646a]"> ({formatDateTime(org.verification_reviewed_at)})</span>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What they told us</CardTitle>
              <CardDescription>{draftCount ?? 0} job post(s) on file, including drafts.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
                {DETAIL_FIELDS.map(([key, label]) => (
                  <div key={key} className="contents">
                    <dt className="text-[#62646a]">{label}</dt>
                    <dd className="break-words text-[#404145]">{display(org as Record<string, unknown>, key)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 text-sm">
                <span className="text-[#62646a]">Wants to: </span>
                {intents.length
                  ? intents.map((k) => ORG_INTENTS.find((i) => i.key === k)?.label ?? k).join(' · ')
                  : '—'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verification details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[220px_1fr]">
                {VERIFY_FIELDS.map(([key, label]) => (
                  <div key={key} className="contents">
                    <dt className="text-[#62646a]">{label}</dt>
                    <dd className="break-words text-[#404145]">{display(org as Record<string, unknown>, key)}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="mb-2 text-sm font-semibold text-[#404145]">Self-disclosures</p>
                <ul className="space-y-2 text-sm">
                  {ORG_DISCLOSURES.map((q) => {
                    const a = disclosures[q.key]
                    const yes = a?.answer === true
                    return (
                      <li key={q.key} className={yes ? 'rounded-md bg-[#fdecea] p-2' : ''}>
                        <span className="text-[#62646a]">{q.question}</span>{' '}
                        <strong className={yes ? 'text-[#c0392b]' : 'text-[#404145]'}>
                          {a == null ? '—' : yes ? 'Yes' : 'No'}
                        </strong>
                        {yes && a?.details && <p className="mt-1 whitespace-pre-line text-[#404145]">{a.details}</p>}
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-[#404145]">Documents</p>
                {orgDocs && orgDocs.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {orgDocs.map((d) => (
                      <li key={d.id}>
                        <span className="text-[#62646a]">
                          {ORG_DOCUMENT_KINDS.find((k) => k.kind === d.kind)?.label ?? d.kind}:
                        </span>{' '}
                        {docLinks.get(d.id) ? (
                          <a href={docLinks.get(d.id)} target="_blank" rel="noreferrer" className="font-semibold text-[#1dbf73] hover:underline">
                            {d.filename}
                          </a>
                        ) : (
                          d.filename
                        )}{' '}
                        <span className="text-xs text-[#95979d]">{formatDateTime(d.uploaded_at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#62646a]">None uploaded.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Manual review checklist ({progress.done}/{progress.total})
              </CardTitle>
              <CardDescription>Save a dated screenshot or PDF of every lookup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {ORG_CHECKLIST.map((item, i) => {
                const entry = checklist[item.key]
                const itemEvidence = evidence.filter((e) => e.check_key === item.key)
                return (
                  <div key={item.key} className="rounded-lg border border-[#e4e5e7] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#404145]">
                          {i + 1}. {item.label}
                        </p>
                        <p className="text-sm text-[#62646a]">{item.help}</p>
                        {item.links && (
                          <div className="mt-1 flex flex-wrap gap-3">
                            {item.links.map((l) => (
                              <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73] hover:underline">
                                {l.label} <ExternalLink className="h-3 w-3" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <form action={setChecklistItem.bind(null, id, item.key)}>
                        <input type="hidden" name="done" value={entry?.done ? 'false' : 'true'} />
                        <input type="hidden" name="note" value={entry?.note ?? ''} />
                        <Button type="submit" size="sm" variant={entry?.done ? 'default' : 'outline'} className={entry?.done ? 'bg-[#1dbf73] text-white hover:bg-[#19a463]' : ''}>
                          {entry?.done ? '✓ Done' : 'Mark done'}
                        </Button>
                      </form>
                    </div>
                    {entry?.at && (
                      <p className="mt-1 text-xs text-[#62646a]">
                        {entry.done ? 'Checked' : 'Unchecked'} {formatDateTime(entry.at)}
                      </p>
                    )}

                    {itemEvidence.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm">
                        {itemEvidence.map((e) => (
                          <li key={e.id} className="text-[#404145]">
                            <span className="text-xs text-[#62646a]">{formatDateTime(e.created_at)}</span>{' '}
                            {signed.get(e.id) && (
                              <a href={signed.get(e.id)} target="_blank" rel="noreferrer" className="font-semibold text-[#1dbf73] hover:underline">
                                {e.storage_path!.split('/').pop()}
                              </a>
                            )}
                            {e.note && <span> — {e.note}</span>}
                          </li>
                        ))}
                      </ul>
                    )}

                    {item.needsEvidence && (
                      <form action={addEvidence.bind(null, id, item.key)} className="mt-3 flex flex-wrap items-center gap-2">
                        <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="max-w-[220px] text-xs" />
                        <input type="text" name="note" placeholder="Note (optional)" className="h-8 min-w-0 flex-1 rounded-md border border-[#e4e5e7] px-2 text-sm" />
                        <Button type="submit" size="sm" variant="outline">Save evidence</Button>
                      </form>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision</CardTitle>
              <CardDescription>
                The organization gets an email and a dashboard notice. Needs info, suspend and
                reject require a note — it&apos;s shown to them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ORG_ALLOWED_DECISIONS[status].map((decision) => (
                <form key={decision} action={decideOrganization.bind(null, id, decision)} className="space-y-2">
                  {ORG_DECISION_NEEDS_NOTE.includes(decision) && (
                    <Textarea name="notes" required rows={3} placeholder={`Note to the organization (${ORG_DECISION_LABEL[decision].toLowerCase()})`} />
                  )}
                  <Button
                    type="submit"
                    className={`w-full ${decision === 'approve' ? 'bg-[#1dbf73] text-white hover:bg-[#19a463]' : ''}`}
                    variant={decision === 'approve' ? 'default' : decision === 'reject' || decision === 'suspend' ? 'destructive' : 'outline'}
                  >
                    {ORG_DECISION_LABEL[decision]}
                  </Button>
                </form>
              ))}
              {status !== 'approved' && progress.done < progress.total && (
                <p className="text-xs text-[#b8860b]">
                  {progress.total - progress.done} checklist item(s) still open.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Red flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {flags.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 font-medium text-[#c0392b]">
                  {flags.map((f) => <li key={f}>{f}</li>)}
                </ul>
              ) : (
                <p className="text-[#0f8f56]">None detected automatically.</p>
              )}
              <div>
                <p className="font-semibold text-[#404145]">Also watch for</p>
                <ul className="list-disc space-y-0.5 pl-5 text-[#62646a]">
                  {ORG_RED_FLAGS.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
