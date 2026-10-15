'use server'

import { refresh } from 'next/cache'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'
import { assignSignupPath, isAssignablePath, requestAppUrl } from '@/lib/admin/classification'
import { CLASSIFY_DECISIONS, isPendingClassification, type ClassifyDecision } from '@/lib/onboarding/signup-path'

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

export interface ChangeCategoryResult {
  ok: boolean
  error?: string
  email?: 'sent' | 'skipped' | 'failed'
}

/**
 * Move an account to another signup category (Independent / Practice /
 * Company / Hiring / Client): updates signup_path + role, creates or resets
 * the profile row the category needs so the person goes through that
 * category's onboarding and verification, and optionally emails the Finish
 * setup link. Same server logic as the Needs classification queue; a Not
 * sure account awaiting placement also gets its queue decision recorded.
 */
export async function changeAccountCategory(
  userId: string,
  path: string,
  options: { note?: string; notify?: boolean }
): Promise<ChangeCategoryResult> {
  const { admin, db } = await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, error: 'Bad account id' }
  if (!isAssignablePath(path)) return { ok: false, error: 'Pick a category' }

  const { data: profile } = await db
    .from('profiles')
    .select('signup_path, classification_status')
    .eq('id', userId)
    .maybeSingle()
  const decision =
    profile && isPendingClassification(profile) && (CLASSIFY_DECISIONS as readonly string[]).includes(path)
      ? (path as ClassifyDecision)
      : null

  try {
    const result = await assignSignupPath(db, {
      userId,
      adminId: admin.id,
      path,
      decision,
      note: String(options.note ?? '').slice(0, 2000),
      notify: options.notify !== false,
      appUrl: await requestAppUrl(),
    })
    refresh()
    return { ok: true, email: result.email }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to change category' }
  }
}
