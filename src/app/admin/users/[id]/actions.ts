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

/**
 * Suspend / reactivate an account. Suspending bans the auth user (blocks
 * sign-in and token refresh) and sets profiles.is_active=false.
 */
export async function setAccountActive(userId: string, active: boolean): Promise<{ error?: string }> {
  const { admin, db } = await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { error: 'Bad account id' }
  if (userId === admin.id && !active) return { error: "You can't suspend your own account" }

  const { error: banError } = await db.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : '876000h',
  })
  if (banError) return { error: `Failed to ${active ? 'unblock' : 'block'} sign-in: ${banError.message}` }

  const { error } = await db.from('profiles').update({ is_active: active }).eq('id', userId)
  if (error) return { error: `Sign-in was ${active ? 'unblocked' : 'blocked'}, but updating the profile failed: ${error.message}` }

  await logAdminAction(
    db, admin.id, active ? 'account_activated' : 'account_suspended',
    'profiles', userId, { is_active: !active }, { is_active: active, banned: !active }
  )
  refresh()
  return {}
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
