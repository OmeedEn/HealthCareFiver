'use server'

import { refresh } from 'next/cache'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'
import { setCareRequestStatus } from '@/lib/admin/care-requests'

/** Care requests queue: mark a request contacted or closed. */
export async function markCareRequest(
  id: string,
  status: 'contacted' | 'closed'
): Promise<{ ok: boolean; error?: string }> {
  const { admin, db } = await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Bad request id' }
  if (status !== 'contacted' && status !== 'closed') return { ok: false, error: 'Unknown status' }

  try {
    await setCareRequestStatus(db, id, status, admin.id)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update' }
  }
  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: `admin_care_request_${status}`,
    targetTable: 'care_requests',
    targetId: id,
  })
  refresh()
  return { ok: true }
}
