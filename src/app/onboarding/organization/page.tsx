import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
import { isDemoMode } from '@/lib/demo/data'
import { formatUsPhoneInput } from '@/lib/phone'
import {
  ORG_DISCLOSURES,
  ORG_INTENT_KEYS,
  type OrgIntent,
  type OrgWizardStep,
} from '@/lib/onboarding/organization'
import { OrgOnboardingWizard } from './wizard'
import { DEFAULT_INTENTS, orgDoorFor, type AboutData, type OrgDoc, type VerifyData, type YesNo } from './shared'

export const metadata: Metadata = { title: 'Set up your organization | Sanus' }

const EMPTY_ABOUT: AboutData = {
  facility_name: '', org_type: '', org_type_other: '', org_size: '', city: '', state: '',
  zip_code: '', location_count: '1', website: '', phone: '', description: '',
}

function emptyVerify(): VerifyData {
  return {
    legal_name: '', business_structure: '', registration_state: '', has_facility_license: '',
    facility_license_type: '', facility_license_number: '', facility_license_agency: '',
    facility_license_expires: '', org_npi: '',
    lead_has_credential: '', lead_credential_type: '', lead_credential_number: '', lead_credential_state: '',
    lead_linkedin: '',
    disclosures: Object.fromEntries(ORG_DISCLOSURES.map((q) => [q.key, { answer: '' as YesNo, details: '' }])),
    attest_authorized: false, attest_checks: false,
  }
}

/**
 * Organization onboarding, steps 2–5 (step 1 is /signup/organization).
 * Progress lives in facility_profiles.onboarding_step (the NEXT step to
 * show). Once onboarding_submitted_at is set this redirects to /dashboard,
 * which shows the "under review" banner.
 */
export default async function OrganizationOnboardingPage() {
  if (isDemoMode()) {
    return (
      <OrgOnboardingWizard
        userId="demo"
        door="HIRING"
        initialStep={2}
        initialAbout={EMPTY_ABOUT}
        initialVerify={emptyVerify()}
        initialDocs={[]}
        initialIntents={DEFAULT_INTENTS.HIRING}
      />
    )
  }

  const user = await currentUser()
  if (!user) redirect('/login?redirectTo=/onboarding/organization')
  if (user.role !== 'facility' && user.role !== 'staffing_agency') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: org }, { data: docs }, { data: auth }, { data: profile }] = await Promise.all([
    // Own row via RPC: private columns aren't readable from the table directly.
    // Untyped like the table read it replaces (no generated DB types yet).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.rpc('my_facility_profile').select('*').single<any>(),
    supabase
      .from('org_documents')
      .select('id, kind, filename, storage_path')
      .eq('facility_id', user.id)
      .order('uploaded_at'),
    supabase.auth.getUser(),
    supabase.from('profiles').select('signup_path').eq('id', user.id).single(),
  ])
  const door = orgDoorFor(profile?.signup_path)
  if (!org) redirect('/dashboard')
  if (org.onboarding_submitted_at) redirect('/dashboard')

  // Email signups put the title in metadata (step 1); copy it over once.
  const metaTitle = String(auth.user?.user_metadata?.contact_title ?? '').trim()
  if (!org.contact_title && metaTitle) {
    await supabase.from('facility_profiles').update({ contact_title: metaTitle.slice(0, 100) }).eq('id', user.id)
  }

  const about: AboutData = {
    facility_name: org.facility_name ?? '',
    org_type: org.org_type ?? '',
    org_type_other: org.org_type_other ?? '',
    org_size: org.org_size ?? '',
    city: org.city ?? '',
    state: org.state ?? '',
    zip_code: org.zip_code ?? '',
    location_count: org.location_count ? String(org.location_count) : '1',
    website: org.website ?? '',
    phone: org.phone ? formatUsPhoneInput(String(org.phone).replace(/^\+1/, '')) : '',
    description: org.description ?? '',
  }

  const saved = (org.self_disclosures ?? {}) as Record<string, { answer?: boolean; details?: string | null }>
  const verify: VerifyData = {
    ...emptyVerify(),
    legal_name: org.legal_name ?? '',
    business_structure: org.business_structure ?? '',
    registration_state: org.registration_state ?? '',
    has_facility_license: org.has_facility_license == null ? '' : org.has_facility_license ? 'yes' : 'no',
    facility_license_type: org.facility_license_type ?? '',
    facility_license_number: org.facility_license_number ?? '',
    facility_license_agency: org.facility_license_agency ?? '',
    facility_license_expires: org.facility_license_expires ?? '',
    org_npi: org.org_npi ?? '',
    lead_has_credential: org.lead_has_credential == null ? '' : org.lead_has_credential ? 'yes' : 'no',
    lead_credential_type: org.lead_credential_type ?? '',
    lead_credential_number: org.lead_credential_number ?? '',
    lead_credential_state: org.lead_credential_state ?? '',
    lead_linkedin: org.lead_linkedin ?? '',
    disclosures: Object.fromEntries(
      ORG_DISCLOSURES.map((q) => {
        const s = saved[q.key]
        const answer: YesNo = s?.answer === true ? 'yes' : s?.answer === false ? 'no' : ''
        return [q.key, { answer, details: s?.details ?? '' }]
      })
    ),
    attest_authorized: !!org.attested_authorized_at,
    attest_checks: !!org.authorized_checks_at,
  }

  const savedIntents = ((org.intents ?? []) as string[]).filter((i): i is OrgIntent =>
    (ORG_INTENT_KEYS as readonly string[]).includes(i)
  )
  // Pre-check the door's usual goals until they've saved their own.
  const intents = savedIntents.length ? savedIntents : DEFAULT_INTENTS[door]
  const step = Math.min(Math.max(Number(org.onboarding_step ?? 2), 2), 5) as OrgWizardStep

  return (
    <OrgOnboardingWizard
      userId={user.id}
      door={door}
      initialStep={step}
      initialAbout={about}
      initialVerify={verify}
      initialDocs={(docs ?? []) as OrgDoc[]}
      initialIntents={intents}
    />
  )
}
