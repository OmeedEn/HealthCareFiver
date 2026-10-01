import { isDemoMode } from '@/lib/demo/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit/log'
import { credentialStoragePath } from '@/lib/credentials/document'
import {
  evidenceFilename,
  type AdminChecklist,
  type ApplicantCheck,
  type ApplicantCredential,
  type ApplicantData,
  type ApplicantDuplicate,
  type ApplicantOffering,
  type ApplicantProfile,
  type EvidenceItem,
} from '../_lib/shared'
import { fetchDuplicateFlags, requireAdminPage } from '../_lib/server'
import { DEMO_APPLICANT } from '../_lib/demo'
import { ApplicantClient } from './applicant-client'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = Record<string, unknown>

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
function bool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

export default async function AdminApplicantPage({
  params,
}: {
  params: Promise<{ contractorId: string }>
}) {
  const { contractorId } = await params

  if (isDemoMode()) {
    return <ApplicantClient data={DEMO_APPLICANT} demo />
  }

  const viewer = await requireAdminPage()
  if (!UUID_RE.test(contractorId)) return <NotFound />

  const adminSupabase = createAdminClient()

  const [profileRes, credentialsRes, evidenceRes, checksRes, offeringsRes, duplicateMap] =
    await Promise.all([
      adminSupabase
        .from('contractor_profiles')
        .select('*, profiles!contractor_profiles_id_fkey(email, phone)')
        .eq('id', contractorId)
        .maybeSingle(),
      adminSupabase
        .from('credentials')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: false }),
      adminSupabase
        .from('verification_evidence')
        .select('id, check_key, storage_path, note, created_by, created_at')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: false }),
      adminSupabase
        .from('provider_verification_checks')
        .select('id, check_type, status, result_summary, checked_at')
        .eq('contractor_id', contractorId),
      adminSupabase
        .from('professional_offerings')
        .select('id, title, status, format, requires_malpractice')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: true }),
      fetchDuplicateFlags([contractorId]),
    ])

  const p = profileRes.data as Row | null
  if (!p) {
    if (profileRes.error) console.error('[admin/verification] load failed', profileRes.error)
    return <NotFound />
  }
  const joined = (p.profiles ?? null) as { email?: string | null; phone?: string | null } | null

  const profile: ApplicantProfile = {
    id: contractorId,
    first_name: str(p.first_name) ?? '',
    last_name: str(p.last_name) ?? '',
    email: joined?.email ?? null,
    phone: joined?.phone ?? null,
    contractor_type: str(p.contractor_type),
    professional_category: str(p.professional_category),
    other_profession: str(p.other_profession),
    credential_basis: str(p.credential_basis),
    legal_name: str(p.legal_name),
    other_names: str(p.other_names),
    license_type: str(p.license_type),
    specialties: arr(p.specialties),
    state_license_number: str(p.state_license_number),
    license_states: arr(p.license_states),
    license_issue_date: str(p.license_issue_date),
    license_expiration_date: str(p.license_expiration_date),
    has_compact_license: bool(p.has_compact_license),
    telehealth_states: arr(p.telehealth_states),
    npi_number: str(p.npi_number),
    years_of_experience: typeof p.years_of_experience === 'number' ? p.years_of_experience : null,
    certification_type: str(p.certification_type),
    certifying_organization: str(p.certifying_organization),
    consulting_background: str(p.consulting_background),
    client_types: arr(p.client_types),
    website_url: str(p.website_url),
    primary_background: str(p.primary_background),
    teaching_topics: str(p.teaching_topics),
    ceu_accreditation: str(p.ceu_accreditation),
    offers_high_risk_services: bool(p.offers_high_risk_services),
    self_disclosures: (p.self_disclosures ?? null) as ApplicantProfile['self_disclosures'],
    carries_liability_insurance: bool(p.carries_liability_insurance),
    attested_accurate_at: str(p.attested_accurate_at),
    authorized_checks_at: str(p.authorized_checks_at),
    verification_status: str(p.verification_status) ?? 'not_submitted',
    verification_notes: str(p.verification_notes),
    verification_reviewed_at: str(p.verification_reviewed_at),
    approved_at: str(p.approved_at),
    insurance_due_at: str(p.insurance_due_at),
    insured_verified_at: str(p.insured_verified_at),
    compliance_hold_reason: str(p.compliance_hold_reason),
    last_exclusion_check_at: str(p.last_exclusion_check_at),
    admin_checklist: (p.admin_checklist ?? {}) as AdminChecklist,
    contractor_agreement_accepted_at: str(p.contractor_agreement_accepted_at),
    city: str(p.city),
    state: str(p.state),
    created_at: str(p.created_at),
    onboarding_completed_at: str(p.onboarding_completed_at),
  }

  const credentials: ApplicantCredential[] = ((credentialsRes.data ?? []) as Row[]).map((c) => ({
    id: String(c.id),
    credential_type: str(c.credential_type) ?? 'other',
    name: str(c.name) ?? 'Document',
    issuing_authority: str(c.issuing_authority),
    license_number: str(c.license_number),
    issued_date: str(c.issued_date),
    expiration_date: str(c.expiration_date),
    coverage_amount: str(c.coverage_amount),
    status: str(c.status) ?? 'pending_review',
    has_document: !!credentialStoragePath(str(c.document_url)),
    document_filename: str(c.document_filename),
    verified_at: str(c.verified_at),
    created_at: str(c.created_at) ?? '',
  }))

  const evidence: EvidenceItem[] = ((evidenceRes.data ?? []) as Row[]).map((e) => ({
    id: String(e.id),
    check_key: str(e.check_key) ?? '',
    note: str(e.note),
    created_by: str(e.created_by),
    created_at: str(e.created_at) ?? '',
    filename: evidenceFilename(str(e.storage_path) ?? ''),
  }))

  // Duplicate flags + the names of the other accounts.
  let duplicates: ApplicantDuplicate[] | null = null
  const flags = duplicateMap.get(contractorId)
  if (flags) {
    const otherIds = [...new Set(flags.map((f) => f.other_contractor))]
    const names = new Map<string, string>()
    if (otherIds.length) {
      const { data: others } = await adminSupabase
        .from('contractor_profiles')
        .select('id, first_name, last_name')
        .in('id', otherIds)
      for (const o of others ?? []) names.set(o.id, `${o.first_name} ${o.last_name}`.trim())
    }
    duplicates = flags.map((f) => ({
      kind: f.kind,
      other_contractor: f.other_contractor,
      other_name: names.get(f.other_contractor) ?? null,
    }))
  }

  // Display names for whoever ticked checklist items / uploaded evidence.
  const adminIds = new Set<string>()
  for (const entry of Object.values(profile.admin_checklist ?? {})) {
    if (entry?.by) adminIds.add(entry.by)
  }
  for (const e of evidence) if (e.created_by) adminIds.add(e.created_by)
  const adminNames: Record<string, string> = {}
  if (adminIds.size) {
    const { data: admins } = await adminSupabase
      .from('profiles')
      .select('id, email')
      .in('id', [...adminIds])
    for (const a of admins ?? []) adminNames[a.id] = a.email
  }

  await audit({
    actorId: viewer.id,
    actorRole: viewer.role,
    action: 'verification_applicant_viewed',
    targetTable: 'contractor_profiles',
    targetId: contractorId,
    phiAccessed: true,
  })

  const data: ApplicantData = {
    profile,
    credentials,
    evidence,
    duplicates,
    checks: (checksRes.data ?? []) as ApplicantCheck[],
    offerings: (offeringsRes.data ?? []) as ApplicantOffering[],
    adminNames,
  }

  return <ApplicantClient data={data} />
}

function NotFound() {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">Provider not found.</div>
  )
}
