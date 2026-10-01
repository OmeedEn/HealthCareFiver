import { isDemoMode } from '@/lib/demo/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminPage } from '../verification/_lib/server'
import { branchFor, isPastDate } from '../verification/_lib/shared'
import { ListingsClient, type ListingRow } from './listings-client'
import { DEMO_LISTINGS } from './demo'

export const dynamic = 'force-dynamic'

const REVIEW_STATUSES = ['pending_review', 'published', 'paused', 'rejected']

interface OfferingRow {
  id: string
  contractor_id: string
  kind: string
  title: string
  description: string | null
  format: string | null
  involves_medical_procedures: boolean | null
  requires_malpractice: boolean | null
  price_cents: number | null
  is_free: boolean
  status: string
  review_notes: string | null
  reviewed_at: string | null
  updated_at: string
  contractor_profiles: {
    first_name: string
    last_name: string
    professional_category: string | null
    other_profession: string | null
    credential_basis: string | null
    license_type: string | null
    license_states: string[] | null
    certification_type: string | null
    certifying_organization: string | null
    specialties: string[] | null
    verification_status: string
    insured_verified_at: string | null
    contractor_agreement_accepted_at: string | null
    compliance_hold_reason: string | null
  } | null
}

function scopeSummary(c: NonNullable<OfferingRow['contractor_profiles']>): string {
  const branch = branchFor(c.professional_category, c.credential_basis)
  const prefix = c.professional_category === 'other' ? `Other (${c.other_profession ?? '?'}) · ` : ''
  const specialty = c.specialties?.[0] ? ` · ${c.specialties[0]}` : ''
  switch (branch) {
    case 'clinical':
      return `${prefix}Licensed: ${c.license_type ?? 'license type not given'} (${(c.license_states ?? []).join(', ') || 'no states'})${specialty}`
    case 'allied':
      return `${prefix}Certified: ${c.certification_type ?? '?'} — ${c.certifying_organization ?? '?'}${specialty}. No license: no diagnosing, prescribing, or injectables.`
    case 'consultant':
      return `${prefix}Consultant, unlicensed${specialty}. Advisory only — no clinical care.`
    case 'educator':
      return `${prefix}Educator${specialty}. Education only — no clinical care.`
    default:
      return `${prefix}Category unknown`
  }
}

export default async function AdminListingsPage() {
  if (isDemoMode()) {
    return <ListingsClient rows={DEMO_LISTINGS} demo />
  }

  await requireAdminPage()
  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('professional_offerings')
    .select(
      'id, contractor_id, kind, title, description, format, involves_medical_procedures, requires_malpractice, price_cents, is_free, status, review_notes, reviewed_at, updated_at, contractor_profiles(first_name, last_name, professional_category, other_profession, credential_basis, license_type, license_states, certification_type, certifying_organization, specialties, verification_status, insured_verified_at, contractor_agreement_accepted_at, compliance_hold_reason)'
    )
    .in('status', REVIEW_STATUSES)
    .order('updated_at', { ascending: true })
    .limit(300)
  if (error) console.error('[admin/listings] load failed', error)

  const offerings = (data ?? []) as unknown as OfferingRow[]

  // Insured = reviewed certificate on file (insured_verified_at) and a
  // verified, unexpired malpractice credential — mirrors is_insured().
  const contractorIds = [...new Set(offerings.map((o) => o.contractor_id))]
  const insuredCreds = new Set<string>()
  if (contractorIds.length) {
    const { data: creds } = await adminSupabase
      .from('credentials')
      .select('contractor_id, expiration_date')
      .in('contractor_id', contractorIds)
      .eq('credential_type', 'malpractice_insurance')
      .eq('status', 'verified')
    for (const c of creds ?? []) {
      if (!isPastDate(c.expiration_date)) insuredCreds.add(c.contractor_id)
    }
  }

  const rows: ListingRow[] = offerings.map((o) => {
    const c = o.contractor_profiles
    const branch = c ? branchFor(c.professional_category, c.credential_basis) : null
    const blockers: string[] = []
    if (c) {
      if (!['approved', 'insurance_pending'].includes(c.verification_status))
        blockers.push(`provider is ${c.verification_status.replace(/_/g, ' ')}`)
      if (!c.contractor_agreement_accepted_at) blockers.push('provider agreement not accepted')
      if (c.compliance_hold_reason) blockers.push(`compliance hold: ${c.compliance_hold_reason}`)
    }
    const insured = !!c?.insured_verified_at && insuredCreds.has(o.contractor_id)
    if (o.requires_malpractice && !insured) blockers.push('needs reviewed malpractice coverage')

    return {
      id: o.id,
      contractorId: o.contractor_id,
      providerName: c ? `${c.first_name} ${c.last_name}`.trim() : 'Unknown provider',
      category: c?.professional_category ?? null,
      otherProfession: c?.other_profession ?? null,
      licensed: branch === 'clinical',
      scope: c ? scopeSummary(c) : '—',
      kind: o.kind,
      title: o.title,
      description: o.description,
      format: o.format,
      involvesMedicalProcedures: !!o.involves_medical_procedures,
      requiresMalpractice: !!o.requires_malpractice,
      insured,
      priceCents: o.price_cents,
      isFree: o.is_free,
      status: o.status,
      reviewNotes: o.review_notes,
      reviewedAt: o.reviewed_at,
      updatedAt: o.updated_at,
      publishBlockers: blockers,
    }
  })

  return (
    <ListingsClient
      rows={rows}
      loadError={error ? 'Could not load listings. Check the server logs.' : null}
    />
  )
}
