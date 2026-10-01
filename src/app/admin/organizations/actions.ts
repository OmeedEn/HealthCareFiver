'use server'

import { refresh } from 'next/cache'
import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'
import { resolveAppUrl } from '@/lib/compliance/notify'
import { sendOrgApprovalEmail, sendOrgReviewActionEmail } from '@/lib/email/resend'
import {
  EVIDENCE_BUCKET,
  EVIDENCE_CONTENT_TYPES,
  EVIDENCE_MAX_BYTES,
  safeFilename,
} from '@/app/api/admin/verification/_lib/evidence'
import {
  ORG_ALLOWED_DECISIONS,
  ORG_DECISION_NEEDS_NOTE,
  ORG_CHECKLIST,
  type OrgChecklist,
  type OrgDecision,
  type OrgStatus,
} from '@/lib/org/review'

type Db = Awaited<ReturnType<typeof requireAdmin>>['db']

const NEXT_STATUS: Record<OrgDecision, OrgStatus> = {
  approve: 'approved',
  needs_info: 'needs_info',
  suspend: 'suspended',
  reject: 'rejected',
  reopen: 'pending_review',
}

const NOTES_REQUIRED = ORG_DECISION_NEEDS_NOTE

const NOTIFICATION: Record<
  OrgDecision,
  { type: string; title: string; body: string } | null
> = {
  approve: {
    type: 'verification_approved',
    title: 'Your organization is approved',
    body: 'You can now publish posts, message professionals, and review applicants.',
  },
  needs_info: {
    type: 'verification_more_info_requested',
    title: 'Action needed on your organization application',
    body: 'Our review team needs more information. See the note on your dashboard.',
  },
  suspend: {
    type: 'verification_suspended',
    title: 'Your organization is suspended',
    body: 'Your posts are hidden. Check your email for details.',
  },
  reject: {
    type: 'verification_rejected',
    title: 'Your organization wasn’t approved',
    body: 'Check your email for details from our review team.',
  },
  reopen: null,
}

async function logAdminAction(
  db: Db,
  adminId: string,
  action: string,
  orgId: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  notes: string | null = null
) {
  await db.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    entity_type: 'facility_profiles',
    entity_id: orgId,
    old_value: oldValue,
    new_value: newValue,
    notes,
  })
  await audit({
    actorId: adminId,
    actorRole: 'admin',
    action,
    targetTable: 'facility_profiles',
    targetId: orgId,
    metadata: newValue ?? undefined,
  })
}

async function appUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return resolveAppUrl(host ? `${proto}://${host}` : undefined)
}

/** Approve / needs info / suspend / reject / reopen an organization. */
export async function decideOrganization(orgId: string, decision: OrgDecision, formData: FormData) {
  const { admin, db } = await requireAdmin()
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 4000)
  if (NOTES_REQUIRED.includes(decision) && !notes) {
    throw new Error('Add a note for the organization explaining this decision.')
  }

  const { data: org, error: loadError } = await db
    .from('facility_profiles')
    .select('id, facility_name, contact_name, verification_status, approved_at, approval_email_sent_at')
    .eq('id', orgId)
    .single()
  if (loadError || !org) throw new Error(`Organization not found: ${loadError?.message ?? orgId}`)

  const from = org.verification_status as OrgStatus
  if (!ORG_ALLOWED_DECISIONS[from]?.includes(decision)) {
    throw new Error(`Can't ${decision} an organization that is ${from}.`)
  }
  const to = NEXT_STATUS[decision]
  const now = new Date().toISOString()

  const update: Record<string, unknown> = {
    verification_status: to,
    verification_notes: notes || null,
    verification_reviewed_by: admin.id,
    verification_reviewed_at: now,
  }
  if (to === 'approved' && !org.approved_at) update.approved_at = now

  const { error } = await db.from('facility_profiles').update(update).eq('id', orgId)
  if (error) throw new Error(`Failed to update organization: ${error.message}`)
  await db.from('profiles').update({ is_verified: to === 'approved' }).eq('id', orgId)

  await logAdminAction(
    db, admin.id, `org_${decision}`, orgId,
    { verification_status: from }, { verification_status: to }, notes || null
  )

  // Notify the org (in-app + email). Failures are logged, never thrown.
  const n = NOTIFICATION[decision]
  if (n) {
    const { error: nErr } = await db.from('notifications').insert({
      user_id: orgId, type: n.type, title: n.title, body: n.body, data: { href: '/dashboard' },
    })
    if (nErr) console.error('[admin/organizations] notification failed', nErr)
  }

  const { data: account } = await db.from('profiles').select('email').eq('id', orgId).single()
  if (account?.email && decision !== 'reopen') {
    const ctx = { contactName: org.contact_name, orgName: org.facility_name, email: account.email }
    try {
      if (decision === 'approve') {
        // Send "You're live" once, on the first approval.
        if (!org.approval_email_sent_at) {
          await sendOrgApprovalEmail(ctx, await appUrl())
          await db.from('facility_profiles').update({ approval_email_sent_at: now }).eq('id', orgId)
        }
      } else {
        await sendOrgReviewActionEmail(ctx, NEXT_STATUS[decision] as 'needs_info' | 'suspended' | 'rejected', notes, await appUrl())
      }
    } catch (err) {
      console.error(`[admin/organizations] ${decision} email failed`, err)
    }
  }

  refresh()
}

/** Tick / untick one manual review checklist item, with an optional note. */
export async function setChecklistItem(orgId: string, key: string, formData: FormData) {
  const { admin, db } = await requireAdmin()
  if (!ORG_CHECKLIST.some((i) => i.key === key)) throw new Error('Unknown checklist item')

  const done = formData.get('done') === 'true'
  const note = String(formData.get('note') ?? '').trim().slice(0, 2000) || null

  const { data: org, error: loadError } = await db
    .from('facility_profiles')
    .select('admin_checklist')
    .eq('id', orgId)
    .single()
  if (loadError || !org) throw new Error('Organization not found')

  const checklist: OrgChecklist = { ...((org.admin_checklist as OrgChecklist) ?? {}) }
  checklist[key] = { done, note, by: admin.id, at: new Date().toISOString() }

  const { error } = await db.from('facility_profiles').update({ admin_checklist: checklist }).eq('id', orgId)
  if (error) throw new Error(`Failed to save checklist: ${error.message}`)

  await logAdminAction(db, admin.id, done ? 'org_check_done' : 'org_check_undone', orgId, null, { key, done }, note)
  refresh()
}

/** Save a dated screenshot/PDF of a lookup (and/or a note) against a checklist item. */
export async function addEvidence(orgId: string, key: string, formData: FormData) {
  const { admin, db } = await requireAdmin()
  if (!ORG_CHECKLIST.some((i) => i.key === key)) throw new Error('Unknown checklist item')

  const note = String(formData.get('note') ?? '').trim().slice(0, 5000) || null
  const file = formData.get('file')
  let storagePath: string | null = null

  if (file instanceof File && file.size > 0) {
    if (file.size > EVIDENCE_MAX_BYTES) throw new Error('File is too large (15 MB max).')
    if (!EVIDENCE_CONTENT_TYPES.includes(file.type)) throw new Error('Upload a PNG, JPEG, WebP, GIF, or PDF.')
    storagePath = `org/${orgId}/${key}/${Date.now()}-${safeFilename(file.name)}`
    const { error: upErr } = await db.storage
      .from(EVIDENCE_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
  }
  if (!storagePath && !note) throw new Error('Attach a file or add a note.')

  const { error } = await db.from('org_verification_evidence').insert({
    facility_id: orgId, check_key: key, storage_path: storagePath, note, created_by: admin.id,
  })
  if (error) throw new Error(`Failed to save evidence: ${error.message}`)

  await logAdminAction(db, admin.id, 'org_evidence_added', orgId, null, { key, storage_path: storagePath }, note)
  refresh()
}
