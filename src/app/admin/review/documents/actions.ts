'use server'

import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'
import { markInsuranceVerified } from '@/lib/compliance/transitions'
import { CREDENTIALS_BUCKET } from '@/lib/credentials/document'
import { ORG_DOCUMENT_KINDS } from '@/lib/onboarding/organization'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * Approve or reject one professional credential: updates the row, notifies
 * the professional in-app, and writes the admin audit log.
 */
export async function reviewCredential(
  credentialId: string,
  decision: 'approve' | 'reject',
  notes?: string
): Promise<{ error?: string; warning?: string }> {
  const { admin, db } = await requireAdmin()
  if (!UUID.test(credentialId)) return { error: 'Credential not found' }
  const note = String(notes ?? '').trim().slice(0, 2000) || null

  const { data: cred } = await db
    .from('credentials')
    .select('id, contractor_id, credential_type, name, status, expiration_date')
    .eq('id', credentialId)
    .maybeSingle()
  if (!cred) return { error: 'Credential not found' }
  if (!['pending_review', 'pending_upload'].includes(cred.status)) {
    return { error: `This credential is already ${String(cred.status).replace('_', ' ')}.` }
  }
  const now = new Date().toISOString()
  const malpractice = cred.credential_type === 'malpractice_insurance'
  if (decision === 'approve' && malpractice && cred.expiration_date && cred.expiration_date < now.slice(0, 10)) {
    return { error: 'This certificate has expired — ask the professional for a current one.' }
  }

  const update =
    decision === 'approve'
      ? { status: 'verified', verified_at: now, verified_by: admin.id }
      : { status: 'rejected', rejection_notes: note }
  const { error } = await db.from('credentials').update(update).eq('id', credentialId)
  if (error) return { error: `Failed to ${decision} credential: ${error.message}` }

  let warning: string | undefined
  if (decision === 'approve' && malpractice) {
    // Turns on the Insured badge and sends its own notification.
    try {
      await markInsuranceVerified(db, cred.contractor_id)
    } catch (err) {
      console.error('[admin/credentials] markInsuranceVerified failed', err)
      warning = 'Certificate verified, but updating their insurance status failed. Use Verify insurance on their review page.'
    }
  } else {
    const { error: nErr } = await db.from('notifications').insert({
      user_id: cred.contractor_id,
      type: decision === 'approve' ? 'credential_verified' : 'credential_rejected',
      title: decision === 'approve' ? `${cred.name} verified` : `${cred.name} wasn’t accepted`,
      body:
        decision === 'approve'
          ? 'Thanks — this document is verified.'
          : note ?? 'Please upload a new copy of this document.',
      data: { href: '/contractor/credentials' },
    })
    if (nErr) {
      console.error('[admin/credentials] notification failed', nErr)
      warning = 'Saved, but the in-app notification could not be sent.'
    }
  }

  const action = decision === 'approve' ? 'credential_verified' : 'credential_rejected'
  await db.from('admin_audit_log').insert({
    admin_id: admin.id,
    action,
    entity_type: 'credentials',
    entity_id: credentialId,
    old_value: { status: cred.status },
    new_value: { status: update.status, contractor_id: cred.contractor_id },
    notes: note,
  })
  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action,
    targetTable: 'credentials',
    targetId: credentialId,
    phiAccessed: true,
    metadata: { contractorId: cred.contractor_id, status: update.status },
  })
  return { warning }
}

export interface OrgDocumentRow {
  id: string
  facilityId: string
  orgName: string
  orgStatus: string
  kind: string
  filename: string
  uploadedAt: string
  url: string | null
}

/** Documents uploaded by organizations awaiting review, newest first. */
export async function listOrgDocumentsForReview(): Promise<OrgDocumentRow[]> {
  const { db } = await requireAdmin()
  const { data: orgs } = await db
    .from('facility_profiles')
    .select('id, facility_name, verification_status')
    .in('verification_status', ['pending_review', 'needs_info'])
    .not('onboarding_submitted_at', 'is', null)
    .limit(500)
  if (!orgs?.length) return []
  const orgById = new Map(orgs.map((o) => [o.id as string, o]))
  const { data: docs } = await db
    .from('org_documents')
    .select('id, facility_id, kind, filename, storage_path, uploaded_at')
    .in('facility_id', [...orgById.keys()])
    .order('uploaded_at', { ascending: false })
    .limit(200)
  return Promise.all(
    (docs ?? []).map(async (d) => {
      const { data } = await db.storage.from(CREDENTIALS_BUCKET).createSignedUrl(d.storage_path, 600)
      const org = orgById.get(d.facility_id)
      return {
        id: d.id,
        facilityId: d.facility_id,
        orgName: (org?.facility_name as string | null) || 'Unnamed organization',
        orgStatus: (org?.verification_status as string) ?? 'pending_review',
        kind: ORG_DOCUMENT_KINDS.find((k) => k.kind === d.kind)?.label ?? d.kind,
        filename: d.filename,
        uploadedAt: d.uploaded_at,
        url: data?.signedUrl ?? null,
      }
    })
  )
}

/**
 * Email/phone for the providers in the review queue. profiles.email/phone
 * aren't readable from the browser (20261017000200_profiles_private_columns),
 * so this goes through the service role behind the admin check.
 */
export async function getCredentialContacts(
  ids: string[]
): Promise<Record<string, { email: string | null; phone: string | null }>> {
  const { db } = await requireAdmin()
  const clean = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500)
  if (!clean.length) return {}
  const { data } = await db.from('profiles').select('id, email, phone').in('id', clean)
  const out: Record<string, { email: string | null; phone: string | null }> = {}
  for (const p of data ?? []) {
    out[p.id as string] = { email: (p.email as string | null) ?? null, phone: (p.phone as string | null) ?? null }
  }
  return out
}
