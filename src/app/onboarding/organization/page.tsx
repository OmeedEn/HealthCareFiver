import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
import { isDemoMode } from '@/lib/demo/data'
import { ORG_TYPE_KEYS, ORG_TYPE_OTHER_MAX, facilityTypeEnumFor, type OrgTypeKey } from '@/lib/onboarding/organization'
import { getProgress } from '@/lib/onboarding/progress'
import { ORG_FLOW_IDS, orgAnswerOnFile, orgFlowDataFromRow } from '@/lib/onboarding/questions/organization'
import {
  VERIFY_REASON_COPY,
  isVerifyReason,
  orgLightSetupDone,
  safeNextPath,
  verifiesLater,
} from '@/lib/onboarding/org-verify-later'
import { OrgOnboardingWizard } from './wizard'
import { EMPTY_ORG_ANSWERS, type OrgAnswers } from './org-screens'
import { isOrgTypeAllowed, orgDoorFor, type OrgDoc, type YesNo } from './shared'

export const metadata: Metadata = { title: 'Set up your organization | Sanus' }

const yesNo = (v: unknown): YesNo => (v === true ? 'yes' : v === false ? 'no' : '')
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/**
 * Organization onboarding after the account exists (screens 4–8 of the
 * Single-Question Onboarding spec, plus screens 1–2 for accounts that
 * never saw them). Once onboarding_submitted_at is set this redirects to
 * /dashboard (or ?next=), which shows the "under review" banner and the
 * Finish your profile checklist.
 *
 * Hiring organizations verify later (src/lib/onboarding/org-verify-later.ts):
 * until type, name and city/state are on file they see only those screens
 * ('light'); after that, this page is the verification flow they're sent to
 * from posting or booking (?verify=<reason>&next=<path>), and it returns
 * them to `next` when they submit.
 */
export default async function OrganizationOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string | string[]; next?: string | string[] }>
}) {
  const params = await searchParams
  const next = safeNextPath(params.next)
  const reasonRaw = Array.isArray(params.verify) ? params.verify[0] : params.verify
  const reason = isVerifyReason(reasonRaw) ? reasonRaw : null

  if (isDemoMode()) {
    return (
      <OrgOnboardingWizard
        userId="demo"
        door="HIRING"
        initialAnswers={EMPTY_ORG_ANSWERS}
        initialDocs={[]}
        askType
        askName
        done={[]}
      />
    )
  }

  const user = await currentUser()
  if (!user) redirect('/login?redirectTo=/onboarding/organization')
  if (user.role !== 'facility' && user.role !== 'staffing_agency') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: row }, { data: docs }, { data: auth }, { data: profile }, progress] = await Promise.all([
    // Own row via RPC: private columns aren't readable from the table directly.
    supabase.rpc('my_facility_profile').select('*').single<Record<string, unknown>>(),
    supabase
      .from('org_documents')
      .select('id, kind, filename, storage_path')
      .eq('facility_id', user.id)
      .order('uploaded_at'),
    supabase.auth.getUser(),
    supabase.from('profiles').select('signup_path').eq('id', user.id).single(),
    getProgress(supabase, user.id, 'organization'),
  ])
  if (!row) redirect('/dashboard')
  if (row.onboarding_submitted_at) redirect(next ?? '/dashboard')
  const door = orgDoorFor(profile?.signup_path)
  let org = row

  // Email signups send screens 1–2 in their metadata; the signup route
  // copies them over, but fill any gap here (e.g. that write failed).
  const meta = (auth.user?.user_metadata ?? {}) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  const metaType = str(meta.org_type)
  if (!org.org_type && (ORG_TYPE_KEYS as readonly string[]).includes(metaType) && isOrgTypeAllowed(door, metaType)) {
    patch.org_type = metaType
    patch.facility_type = facilityTypeEnumFor(metaType as OrgTypeKey)
    patch.org_type_other = metaType === 'other' ? str(meta.org_type_other).trim().slice(0, ORG_TYPE_OTHER_MAX) || null : null
  }
  const metaName = str(meta.facility_name).trim().slice(0, 200)
  if (!str(org.facility_name).trim() && metaName) patch.facility_name = metaName
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('facility_profiles').update(patch).eq('id', user.id)
    if (error) console.error('[onboarding/organization] metadata copy failed', { code: error.code })
    else org = { ...org, ...patch }
  }

  const docList = (docs ?? []) as OrgDoc[]
  const flow = orgFlowDataFromRow(org, docList.map((d) => d.kind))
  const onFile = ORG_FLOW_IDS.filter((id) => orgAnswerOnFile(id, flow, door))
  const done = Array.from(new Set([...progress.answered, ...progress.skipped, ...onFile]))

  const initialAnswers: OrgAnswers = {
    ...EMPTY_ORG_ANSWERS,
    org_type: str(org.org_type),
    org_type_other: str(org.org_type_other),
    facility_name: str(org.facility_name),
    // Only show the URL we stored, without the scheme we added.
    website: str(org.website).replace(/^https?:\/\//i, ''),
    has_no_website: org.has_no_website === true,
    city: str(org.city),
    state: str(org.state),
    has_facility_license: yesNo(org.has_facility_license),
    facility_license_type: str(org.facility_license_type),
    facility_license_number: str(org.facility_license_number),
    facility_license_agency: str(org.facility_license_agency),
    lead_has_credential: yesNo(org.lead_has_credential),
    lead_credential_type: str(org.lead_credential_type),
    lead_credential_number: str(org.lead_credential_number),
    lead_credential_state: str(org.lead_credential_state),
  }

  // Hiring: only type, name and city/state until they're on file; the
  // verification screens wait until something needs them.
  const buyer = verifiesLater(profile?.signup_path)
  const mode = buyer && !orgLightSetupDone(org) ? 'light' : 'full'
  // Buyers can always step out of verification ("Not now").
  const intro = mode === 'full' && buyer ? VERIFY_REASON_COPY[reason ?? 'any'] : null

  return (
    <OrgOnboardingWizard
      userId={user.id}
      door={door}
      initialAnswers={initialAnswers}
      initialDocs={docList}
      askType={!orgAnswerOnFile('org_type', flow, door)}
      askName={!orgAnswerOnFile('org_name', flow, door)}
      done={done}
      mode={mode}
      intro={intro}
      next={next}
    />
  )
}
