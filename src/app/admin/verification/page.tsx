import { isDemoMode } from '@/lib/demo/data'
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

export default async function AdminVerificationQueuePage() {
  if (isDemoMode()) {
    return <QueueClient rows={DEMO_QUEUE} rescreenDays={EXCLUSION_RESCREEN_DAYS} demo />
  }

  await requireAdminPage()
  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('contractor_profiles')
    .select(
      'id, first_name, last_name, professional_category, other_profession, credential_basis, verification_status, updated_at, self_disclosures, last_exclusion_check_at, insurance_due_at, profiles(email)'
    )
    .in('verification_status', [...VERIFICATION_STATUSES])
    .order('updated_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[admin/verification] queue load failed', error)
  }

  const profiles = (data ?? []) as unknown as ProfileRow[]
  const duplicates = await fetchDuplicateFlags(profiles.map((p) => p.id))

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
  }))

  return (
    <QueueClient
      rows={rows}
      rescreenDays={EXCLUSION_RESCREEN_DAYS}
      loadError={error ? 'Could not load applicants. Check the server logs.' : null}
    />
  )
}
