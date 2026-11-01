import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { cn } from '@/lib/utils'
import { countPendingVerification } from '@/lib/admin/verification-counts'
import { OrgQueue } from '../organizations/org-queue'
import { createAdminClient } from '@/lib/supabase/admin'
import { EXCLUSION_RESCREEN_DAYS } from '@/lib/compliance/config'
import {
  VERIFICATION_STATUSES,
  disclosureYesKeys,
  isRescreenDue,
  type SelfDisclosures,
} from './_lib/shared'
import { fetchDuplicateFlags, requireAdminPage } from './_lib/server'
import { QueueClient, type QueueRow } from './queue-client'
import { DEMO_QUEUE } from './_lib/demo'
import { branchFor } from './_lib/shared'
import {
  professionalMissingForApproval,
  type CredentialLike,
} from '@/lib/onboarding/checklist-professional'

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  first_name: string
  last_name: string
  professional_category: string | null
  other_profession: string | null
  credential_basis: string | null
  verification_status: string
  updated_at: string
  self_disclosures: SelfDisclosures | null
  last_exclusion_check_at: string | null
  insurance_due_at: string | null
  profiles: { email: string | null } | null
}

type Tab = 'professionals' | 'organizations'

/** Professionals / Organizations toggle with pending counts. */
function VerificationTabs({ tab, counts }: { tab: Tab; counts?: { pros: number; orgs: number } }) {
  const tabs: { key: Tab; label: string; count?: number; href: string }[] = [
    { key: 'professionals', label: 'Professionals', count: counts?.pros, href: '/admin/verification' },
    { key: 'organizations', label: 'Organizations', count: counts?.orgs, href: '/admin/verification?tab=organizations' },
  ]
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-[#404145]">Verification</h1>
      <div className="inline-flex rounded-lg border border-[#e4e5e7] bg-white p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
              tab === t.key ? 'bg-[#e8faf1] font-semibold text-[#0f8f56]' : 'text-[#62646a] hover:text-[#1dbf73]'
            )}
          >
            {t.label}
            {!!t.count && (
              <span className="rounded-full bg-[#1dbf73] px-1.5 text-[11px] font-semibold leading-[18px] text-white">
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default async function AdminVerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>
}) {
  const { tab: tabParam, status } = await searchParams
  const tab: Tab = tabParam === 'organizations' ? 'organizations' : 'professionals'

  if (isDemoMode()) {
    return (
      <div className="space-y-6">
        <VerificationTabs tab="professionals" />
        <QueueClient rows={DEMO_QUEUE} rescreenDays={EXCLUSION_RESCREEN_DAYS} demo />
      </div>
    )
  }

  await requireAdminPage()
  const adminSupabase = createAdminClient()
  const counts = await countPendingVerification(adminSupabase)

  if (tab === 'organizations') {
    return (
      <div className="space-y-6">
        <VerificationTabs tab={tab} counts={counts} />
        <OrgQueue
          status={status}
          hrefFor={(f) => `/admin/verification?tab=organizations${f ? `&status=${f}` : ''}`}
        />
      </div>
    )
  }

  const { data, error } = await adminSupabase
    .from('contractor_profiles')
    .select(
      'id, first_name, last_name, professional_category, other_profession, credential_basis, verification_status, updated_at, self_disclosures, last_exclusion_check_at, insurance_due_at, profiles!contractor_profiles_id_fkey(email)'
    )
    .in('verification_status', [...VERIFICATION_STATUSES])
    .order('updated_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[admin/verification] queue load failed', error)
  }

  const profiles = (data ?? []) as unknown as ProfileRow[]
  const ids = profiles.map((p) => p.id)
  const [duplicates, { data: credRows, error: credError }] = await Promise.all([
    fetchDuplicateFlags(ids),
    // Uploads, for the Needed-for-approval "Missing" badges.
    ids.length
      ? adminSupabase
          .from('credentials')
          .select('contractor_id, credential_type, document_url, status')
          .in('contractor_id', ids)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (credError) console.error('[admin/verification] credentials load failed', credError.code)
  const credsBy = new Map<string, CredentialLike[]>()
  for (const c of (credRows ?? []) as (CredentialLike & { contractor_id: string })[]) {
    credsBy.set(c.contractor_id, [...(credsBy.get(c.contractor_id) ?? []), c])
  }

  const rows: QueueRow[] = profiles.map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`.trim(),
    email: p.profiles?.email ?? null,
    category: p.professional_category,
    otherProfession: p.other_profession,
    credentialBasis: p.credential_basis,
    status: p.verification_status,
    updatedAt: p.updated_at,
    disclosuresYes: disclosureYesKeys(p.self_disclosures),
    duplicateCount: duplicates.has(p.id) ? duplicates.get(p.id)!.length : null,
    rescreenDue: isRescreenDue(
      p.verification_status,
      p.last_exclusion_check_at,
      EXCLUSION_RESCREEN_DAYS
    ),
    lastExclusionCheckAt: p.last_exclusion_check_at,
    insuranceDueAt: p.insurance_due_at,
    missing: credError
      ? []
      : professionalMissingForApproval(
          branchFor(p.professional_category, p.credential_basis),
          credsBy.get(p.id) ?? []
        ),
  }))

  return (
    <div className="space-y-6">
      <VerificationTabs tab={tab} counts={counts} />
      <QueueClient
        rows={rows}
        rescreenDays={EXCLUSION_RESCREEN_DAYS}
        loadError={error ? 'Could not load applicants. Check the server logs.' : null}
      />
    </div>
  )
}
