'use server'

import { refresh } from 'next/cache'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'

async function logAdminAction(
  db: Awaited<ReturnType<typeof requireAdmin>>['db'],
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  notes: string | null = null
) {
  await db.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: oldValue,
    new_value: newValue,
    notes,
  })
  await audit({
    actorId: adminId,
    actorRole: 'admin',
    action,
    targetTable: entityType,
    targetId: entityId,
    metadata: newValue ?? undefined,
  })
}

export async function setAccountActive(userId: string, active: boolean) {
  const { admin, db } = await requireAdmin()
  if (userId === admin.id && !active) throw new Error("You can't suspend your own account")

  const { error } = await db.from('profiles').update({ is_active: active }).eq('id', userId)
  if (error) throw new Error(`Failed to update account: ${error.message}`)

  await logAdminAction(
    db, admin.id, active ? 'account_activated' : 'account_suspended',
    'profiles', userId, { is_active: !active }, { is_active: active }
  )
  refresh()
}

/**
 * Manual verification flag for the account (profiles.is_verified) and, for
 * facilities, facility_profiles.is_verified. Provider license/background
 * review lives in /admin/verification/[id].
 */
export async function setAccountVerified(userId: string, verified: boolean) {
  const { admin, db } = await requireAdmin()

  const { error } = await db.from('profiles').update({ is_verified: verified }).eq('id', userId)
  if (error) throw new Error(`Failed to update verification: ${error.message}`)
  // For organizations, verification is the review status (is_verified syncs from it).
  await db
    .from('facility_profiles')
    .update({ verification_status: verified ? 'approved' : 'pending_review' })
    .eq('id', userId)

  await logAdminAction(
    db, admin.id, verified ? 'account_verified' : 'account_unverified',
    'profiles', userId, { is_verified: !verified }, { is_verified: verified }
  )
  refresh()
}

export async function addAdminNote(userId: string, formData: FormData) {
  const { admin, db } = await requireAdmin()
  const note = String(formData.get('note') ?? '').trim().slice(0, 2000)
  if (!note) return

  await logAdminAction(db, admin.id, 'admin_note', 'profiles', userId, null, null, note)
  refresh()
}
