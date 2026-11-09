'use server'

import { refresh } from 'next/cache'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'

// Live enum dispute_status. There is no plain "resolved": an outcome says who it favoured.
const STATUSES = ['open', 'under_review', 'escalated', 'resolved_contractor', 'resolved_facility', 'closed'] as const
type DisputeStatus = (typeof STATUSES)[number]
const FINAL: DisputeStatus[] = ['resolved_contractor', 'resolved_facility', 'closed']

const UUID = /^[0-9a-f-]{36}$/i

export async function updateDispute(disputeId: string, formData: FormData) {
  const { admin, db } = await requireAdmin()
  if (!UUID.test(disputeId)) throw new Error('Invalid dispute')
  const status = String(formData.get('status') ?? '') as DisputeStatus
  if (!STATUSES.includes(status)) throw new Error('Invalid status')
  const resolution = String(formData.get('resolution') ?? '').trim().slice(0, 5000)
  const final = FINAL.includes(status)
  if (final && !resolution) throw new Error('Add a resolution note before closing a dispute.')

  const { data: before, error: loadError } = await db
    .from('disputes')
    .select('status')
    .eq('id', disputeId)
    .maybeSingle()
  if (loadError || !before) throw new Error('Dispute not found')

  const { error } = await db
    .from('disputes')
    .update({
      status,
      resolution: resolution || null,
      resolved_at: final ? new Date().toISOString() : null,
      resolved_by: final ? admin.id : null,
    })
    .eq('id', disputeId)
  if (error) throw new Error(`Failed to update dispute: ${error.message}`)

  if (before.status !== status) {
    await db.from('admin_audit_log').insert({
      admin_id: admin.id,
      action: 'dispute_status_changed',
      entity_type: 'disputes',
      entity_id: disputeId,
      old_value: { status: before.status },
      new_value: { status },
      notes: resolution || null,
    })
    await audit({
      actorId: admin.id,
      actorRole: 'admin',
      action: 'dispute_status_changed',
      targetTable: 'disputes',
      targetId: disputeId,
    })
  }
  refresh()
}
