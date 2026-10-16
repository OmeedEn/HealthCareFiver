import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
import { DEMO_CONTRACTOR, isDemoMode } from '@/lib/demo/data'
import { isProFinishItem } from '@/lib/onboarding/checklist-professional'
import {
  effectiveBranch,
  isProfessionalCategory,
  type ProfessionalBranch,
} from '@/lib/onboarding/professional-branch'
import type { UploadedDoc } from '@/app/onboarding/professional/shared'
import { FinishItemFlow, type FinishValues } from './flow'

export const metadata: Metadata = { title: 'Finish your profile | Sanus' }

/**
 * One "Finish your profile" item as a single-question screen (same
 * QuestionFlow as onboarding). Items with a fuller page elsewhere (headshot,
 * bio, listings, availability, payouts) link there from the checklist instead.
 */
export default async function FinishProfessionalItemPage({
  params,
}: {
  params: Promise<{ item: string }>
}) {
  const { item } = await params
  if (!isProFinishItem(item)) notFound()

  if (isDemoMode()) {
    return (
      <FinishItemFlow
        item={item}
        userId={DEMO_CONTRACTOR.id}
        branch="clinical"
        values={EMPTY_VALUES}
        docs={[]}
      />
    )
  }

  const user = await currentUser()
  if (!user) redirect(`/login?redirectTo=/dashboard/finish/professional/${item}`)
  if (user.role !== 'contractor') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: p }, { data: profile }, { data: creds }] = await Promise.all([
    supabase
      .from('contractor_profiles')
      .select(
        'professional_category, credential_basis, years_of_experience, specialties, npi_number, license_issue_date, license_expiration_date, other_names, telehealth_states, has_compact_license, languages, website_url'
      )
      .eq('id', user.id)
      .single(),
    supabase.rpc('my_profile').select('phone').maybeSingle(),
    supabase
      .from('credentials')
      .select('id, credential_type, name, document_filename, document_url, status')
      .eq('contractor_id', user.id)
      .in('credential_type', ['license', 'certification', 'resume', 'government_id'])
      .order('created_at', { ascending: false }),
  ])
  if (!p) redirect('/dashboard')

  const branch: ProfessionalBranch | null = isProfessionalCategory(p.professional_category)
    ? effectiveBranch(p.professional_category, p.credential_basis)
    : null
  // Uploads need the category (it decides license / certification / resume).
  if (!branch && (item === 'credential_upload' || item === 'government_id')) redirect('/contractor/credentials/upload')

  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const values: FinishValues = {
    years: typeof p.years_of_experience === 'number' ? String(p.years_of_experience) : '',
    specialties: arr(p.specialties),
    npi: s(p.npi_number),
    issue: s(p.license_issue_date).slice(0, 10),
    expires: s(p.license_expiration_date).slice(0, 10),
    other_names: s(p.other_names),
    states: arr(p.telehealth_states),
    compact: p.has_compact_license === true ? 'yes' : p.has_compact_license === false ? 'no' : '',
    languages: arr(p.languages),
    phone: s(profile?.phone),
    website: s(p.website_url),
  }

  return (
    <FinishItemFlow
      item={item}
      userId={user.id}
      branch={branch}
      values={values}
      docs={(creds ?? []) as UploadedDoc[]}
    />
  )
}

const EMPTY_VALUES: FinishValues = {
  years: '',
  specialties: [],
  npi: '',
  issue: '',
  expires: '',
  other_names: '',
  states: [],
  compact: '',
  languages: [],
  phone: '',
  website: '',
}
