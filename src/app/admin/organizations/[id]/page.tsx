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
  ['facility_type', 'Type'],
  ['description', 'Description'],
  ['website', 'Website'],
  ['phone', 'Phone'],
  ['address_line_1', 'Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['zip_code', 'ZIP'],
  ['contact_name', 'Contact'],
  ['contact_title', 'Contact title'],
  ['contact_email', 'Contact email'],
  ['ein', 'EIN'],
]

export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { db } = await requireAdmin()
  const { id } = await params

  const [{ data: org }, { data: account }, { data: evidenceRows }, { count: draftCount }] =
    await Promise.all([
      db.from('facility_profiles').select('*').eq('id', id).maybeSingle(),
      db.from('profiles').select('email, phone, created_at').eq('id', id).maybeSingle(),
      db
        .from('org_verification_evidence')
        .select('id, check_key, storage_path, note, created_at')
        .eq('facility_id', id)
        .order('created_at', { ascending: false }),
      db.from('jobs').select('id', { count: 'exact', head: true }).eq('facility_id', id),
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
                    <dd className="break-words text-[#404145]">{(org as Record<string, unknown>)[key] ? String((org as Record<string, unknown>)[key]) : '—'}</dd>
                  </div>
                ))}
              </dl>
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
