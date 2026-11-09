'use server'

import { refresh } from 'next/cache'
import { requireAdmin } from '@/lib/admin/guard'

const STATUSES = ['open', 'in_progress', 'resolved', 'wont_fix'] as const

export async function updateBug(bugId: string, formData: FormData) {
  const { admin, db } = await requireAdmin()
  const status = String(formData.get('status') ?? '')
  const adminNotes = String(formData.get('admin_notes') ?? '').trim().slice(0, 5000)
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error('Invalid status')
  }

  const closed = status === 'resolved' || status === 'wont_fix'
  const { data: before } = await db.from('bug_reports').select('status').eq('id', bugId).single()

  const { error } = await db
    .from('bug_reports')
    .update({
      status,
      admin_notes: adminNotes || null,
      resolved_at: closed ? new Date().toISOString() : null,
      resolved_by: closed ? admin.id : null,
    })
    .eq('id', bugId)
  if (error) throw new Error(`Failed to update bug: ${error.message}`)

  if (before?.status !== status) {
    await db.from('admin_audit_log').insert({
      admin_id: admin.id,
      action: 'bug_status_changed',
      entity_type: 'bug_reports',
      entity_id: bugId,
      old_value: { status: before?.status ?? null },
      new_value: { status },
      notes: adminNotes || null,
    })
  }
  refresh()
}
