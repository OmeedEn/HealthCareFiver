import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/demo/data'
import { currentUser } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { isOrgFinishItem } from '@/lib/onboarding/checklist-organization'
import { orgDoorFor, type OrgDoc } from '@/app/onboarding/organization/shared'
import { OrgFinishFlow, type OrgFinishValues } from './finish-flow'

export const metadata: Metadata = { title: 'Finish your profile | Sanus' }

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/**
 * One "Finish your profile" item for an organization, asked as a
 * single-question screen (same QuestionFlow as onboarding). Saves, marks the
 * item answered in onboarding_progress, and returns to the dashboard.
 */
export default async function OrgFinishItemPage({ params }: { params: Promise<{ item: string }> }) {
  const { item } = await params
  if (!isOrgFinishItem(item)) notFound()
  if (isDemoMode()) redirect('/dashboard')

  const user = await currentUser()
  if (!user) redirect(`/login?redirectTo=/dashboard/finish/organization/${item}`)
  if (user.role !== 'facility' && user.role !== 'staffing_agency') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: org }, { data: docs }, { data: profile }] = await Promise.all([
    supabase.rpc('my_facility_profile').select('*').single<Record<string, unknown>>(),
    supabase.from('org_documents').select('id, kind, filename, storage_path').eq('facility_id', user.id).order('uploaded_at'),
    supabase.from('profiles').select('signup_path').eq('id', user.id).single(),
  ])
  if (!org) redirect('/dashboard')
  const door = orgDoorFor(profile?.signup_path)
  const hasLicense = org.has_facility_license === true
  // Door- and answer-specific items.
  if (item === 'lead_linkedin' && door !== 'COMPANY') notFound()
  if (item === 'license_expires' && !hasLicense) notFound()

  const sd = (org.self_disclosures ?? {}) as Record<string, { answer?: boolean; details?: string | null } | undefined>
  const picked = Object.entries(sd)
    .filter(([, a]) => a?.answer === true)
    .map(([k]) => k)
  const values: OrgFinishValues = {
    description: str(org.description),
    org_size: str(org.org_size),
    zip_code: str(org.zip_code),
    location_count: org.location_count == null ? '' : String(org.location_count),
    phone: str(org.phone).replace(/^\+1/, ''),
    legal_name: str(org.legal_name),
    business_structure: str(org.business_structure),
    registration_state: str(org.registration_state),
    org_npi: str(org.org_npi),
    contact_title: str(org.contact_title),
    lead_linkedin: str(org.lead_linkedin).replace(/^https?:\/\//i, ''),
    facility_license_expires: str(org.facility_license_expires),
    disclosures_picked: picked,
    disclosures_details: Object.values(sd).find((a) => a?.answer === true)?.details ?? '',
    disclosures_answered: Object.keys(sd).length > 0,
  }

  return (
    <div className="mx-auto w-full max-w-xl py-4 sm:py-8">
      <OrgFinishFlow
        item={item}
        userId={user.id}
        hasLicense={hasLicense}
        initial={values}
        initialDocs={(docs ?? []) as OrgDoc[]}
      />
    </div>
  )
}
