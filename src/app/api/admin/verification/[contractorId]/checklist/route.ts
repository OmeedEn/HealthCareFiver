import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit/log'
import { isUuid, requireAdminApi } from '@/app/api/admin/_lib/guard'

const KEY_RE = /^[a-z0-9_]{1,64}$/

/**
 * Persist one item of the manual review checklist into
 * contractor_profiles.admin_checklist ({ key: { done, by, at, note } }).
 * Body: { key, done, note? }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const admin = guard.admin

  const { contractorId } = await params
  if (!isUuid(contractorId)) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const key = body.key
  if (typeof key !== 'string' || !KEY_RE.test(key)) {
    return NextResponse.json({ error: 'Invalid checklist item' }, { status: 400 })
  }
  if (typeof body.done !== 'boolean') {
    return NextResponse.json({ error: 'done must be true or false' }, { status: 400 })
  }
  const note =
    typeof body.note === 'string' && body.note.trim()
      ? body.note.trim().slice(0, 2000)
      : null

  const adminSupabase = createAdminClient()
  const { data: row, error: loadError } = await adminSupabase
    .from('contractor_profiles')
    .select('admin_checklist')
    .eq('id', contractorId)
    .single()
  if (loadError || !row) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  }

  const entry = { done: body.done, by: admin.id, at: new Date().toISOString(), note }
  const checklist = {
    ...((row.admin_checklist as Record<string, unknown> | null) ?? {}),
    [key]: entry,
  }

  const { error } = await adminSupabase
    .from('contractor_profiles')
    .update({ admin_checklist: checklist })
    .eq('id', contractorId)
  if (error) {
    return NextResponse.json({ error: 'Failed to save checklist' }, { status: 500 })
  }

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'verification_checklist_updated',
    targetTable: 'contractor_profiles',
    targetId: contractorId,
    phiAccessed: true,
    metadata: { key, done: body.done, hasNote: !!note },
  })

  return NextResponse.json({ success: true, key, entry })
}
