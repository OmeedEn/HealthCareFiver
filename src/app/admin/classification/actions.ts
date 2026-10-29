'use server'

import { refresh } from 'next/cache'
import { requireAdmin } from '@/lib/admin/guard'
import { assignSignupPath, requestAppUrl } from '@/lib/admin/classification'
import { CLASSIFY_DECISIONS, type ClassifyDecision } from '@/lib/onboarding/signup-path'
import { isProfessionalCategory } from '@/lib/onboarding/professional-branch'
import { isPickableOrgType, type StaffPicks } from '@/lib/onboarding/unsure-prefill'

export interface ClassifyResult {
  ok: boolean
  error?: string
  email?: 'sent' | 'skipped' | 'failed'
}

/**
 * Needs classification queue: place a Not sure signup as Independent /
 * Practice / Company / Client, or reject (stays a client). Emails the
 * person; a failed email is logged and reported, never blocking.
 */
export async function classifySignup(
  userId: string,
  decision: ClassifyDecision,
  note: string,
  /** Optional: "Kind of professional" (Independent) or "Organization type" (Practice/Company). */
  picks?: { category?: string | null; orgType?: string | null }
): Promise<ClassifyResult> {
  const { admin, db } = await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, error: 'Bad account id' }
  if (!(CLASSIFY_DECISIONS as readonly string[]).includes(decision)) {
    return { ok: false, error: 'Unknown decision' }
  }

  // Only keep picks that fit the decision; anything else is ignored.
  const checked: StaffPicks = {}
  if (decision === 'INDEPENDENT' && isProfessionalCategory(picks?.category)) checked.category = picks.category
  if ((decision === 'PRACTICE' || decision === 'COMPANY') && isPickableOrgType(decision, picks?.orgType)) {
    checked.orgType = picks.orgType
  }

  try {
    const result = await assignSignupPath(db, {
      userId,
      adminId: admin.id,
      path: decision === 'REJECTED' ? null : decision,
      decision,
      note: String(note ?? '').slice(0, 2000),
      notify: true,
      appUrl: await requestAppUrl(),
      picks: checked,
    })
    refresh()
    return { ok: true, email: result.email }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to classify' }
  }
}
