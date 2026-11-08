import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/guard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import {
  ORG_STATUSES,
  ORG_STATUS_BADGE,
  ORG_STATUS_LABEL,
  checklistProgress,
  isOrgStatus,
  type OrgChecklist,
  type OrgStatus,
} from '@/lib/org/review'
import { FREE_EMAIL_DOMAINS, emailDomain } from '@/lib/org/red-flags'
import { ORG_CHECKLIST_COLUMNS, orgMissingForApproval, type OrgChecklistRow } from '@/lib/onboarding/checklist-organization'
import { ORG_FLOW_IDS, orgAnswerOnFile, orgFlowDataFromRow } from '@/lib/onboarding/questions/organization'
import { orgDoorFor } from '@/app/onboarding/organization/shared'
import { verifiesLater } from '@/lib/onboarding/org-verify-later'

const OPEN: OrgStatus[] = ['pending_review', 'needs_info']
type Filter = 'open' | 'incomplete' | 'all' | OrgStatus

interface Row extends OrgChecklistRow {
  id: string
  facility_name: string
  facility_type: string
  city: string | null
  state: string | null
  verification_status: string
  admin_checklist: OrgChecklist | null
  onboarding_submitted_at: string | null
  onboarding_step: number | null
  created_at: string
  updated_at: string
  profiles: { email: string | null; signup_path: string | null } | null
}

/** Organization review queue. Shown under Verification → Organizations. */
export async function OrgQueue({
  status,
  hrefFor,
}: {
  status?: string
  hrefFor: (filter: string | null) => string
}) {
  const { db } = await requireAdmin()
  const filter: Filter =
    status === 'all' || status === 'incomplete' || isOrgStatus(status) ? (status as Filter) : 'open'

  const { data, error } = await db
    .from('facility_profiles')
    .select(
      `id, facility_name, facility_type, org_type, org_type_other, website, has_no_website, city, state, facility_license_type, facility_license_number, facility_license_agency, lead_credential_type, lead_credential_number, lead_credential_state, admin_checklist, onboarding_submitted_at, onboarding_step, created_at, updated_at, ${ORG_CHECKLIST_COLUMNS}, profiles!facility_profiles_id_fkey(email, signup_path)`
    )
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) console.error('[admin/organizations] load failed', error)

  const everyone = (data ?? []) as unknown as Row[]
  // Document kinds per org, for the Needed for approval ("Missing") items.
  const { data: docRows } = everyone.length
    ? await db.from('org_documents').select('facility_id, kind').in('facility_id', everyone.map((r) => r.id))
    : { data: [] as { facility_id: string; kind: string }[] }
  const docKinds = new Map<string, string[]>()
  for (const d of docRows ?? []) docKinds.set(d.facility_id, [...(docKinds.get(d.facility_id) ?? []), d.kind])
  // Orgs still mid-signup aren't ready to review; they get their own tab.
  const incomplete = everyone.filter((r) => !r.onboarding_submitted_at)
  const all = everyone.filter((r) => r.onboarding_submitted_at)
  const counts = Object.fromEntries(
    ORG_STATUSES.map((s) => [s, all.filter((r) => r.verification_status === s).length])
  ) as Record<OrgStatus, number>
  const rows =
    filter === 'incomplete'
      ? incomplete
      : all.filter((r) =>
          filter === 'all'
            ? true
            : filter === 'open'
              ? OPEN.includes(r.verification_status as OrgStatus)
              : r.verification_status === filter
        )

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'open', label: 'Needs review', count: counts.pending_review + counts.needs_info },
    ...ORG_STATUSES.map((s) => ({ key: s as Filter, label: ORG_STATUS_LABEL[s], count: counts[s] })),
    { key: 'incomplete', label: 'Signup not finished', count: incomplete.length },
    { key: 'all', label: 'All submitted', count: all.length },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#5f5d57]">
        Every organization is reviewed before it can publish, message professionals, or review
        applicants. Oldest first.
      </p>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={hrefFor(t.key === 'open' ? null : t.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              filter === t.key
                ? 'border-[#2f3cf5] bg-[#eceefe] font-semibold text-[#2330c8]'
                : 'border-[#e3dfd6] text-[#5f5d57] hover:border-[#2f3cf5]'
            )}
          >
            {t.label} <span className="text-xs opacity-70">{t.count}</span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} organization{rows.length === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-red-600">Could not load organizations. Check the server logs.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[#5f5d57]">Nothing here.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Missing</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Signed up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const s = isOrgStatus(r.verification_status) ? r.verification_status : 'pending_review'
                  const { done, total } = checklistProgress(r.admin_checklist, r.profiles?.signup_path)
                  const freeEmail = FREE_EMAIL_DOMAINS.has(emailDomain(r.profiles?.email))
                  const kinds = docKinds.get(r.id) ?? []
                  const missing = orgMissingForApproval({ org: r, docKinds: kinds })
                  const door = orgDoorFor(r.profiles?.signup_path)
                  const flow = orgFlowDataFromRow(r as unknown as Record<string, unknown>, kinds)
                  const answered = ORG_FLOW_IDS.filter((q) => q !== 'submit' && orgAnswerOnFile(q, flow, door)).length
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/admin/organizations/${r.id}`}
                          className="font-semibold text-[#1a1a17] hover:text-[#2f3cf5]"
                        >
                          {r.facility_name || 'Unnamed organization'}
                        </Link>
                        <div className="text-xs text-[#5f5d57]">{r.profiles?.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {[r.city, r.state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ORG_STATUS_BADGE[s]}>{ORG_STATUS_LABEL[s]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.onboarding_submitted_at
                          ? `${done}/${total}`
                          : `${verifiesLater(r.profiles?.signup_path) ? 'Buyer, verifying later' : 'Signup'}: ${answered} of ${ORG_FLOW_IDS.length - 1} answered`}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {missing.map((m) => (
                            <Badge key={m.id} variant="destructive" title={m.label}>
                              Missing: {m.id === 'registration_doc' ? 'registration upload' : 'disclosures'}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {freeEmail && <Badge variant="outline">Free email</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-[#5f5d57]">
                        {formatRelativeTime(r.created_at)}
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
