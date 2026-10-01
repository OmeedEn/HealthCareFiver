import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit/log'
import { isUuid, requireAdminApi } from '@/app/api/admin/_lib/guard'
import {
  CHECK_KEY_RE,
  EVIDENCE_BUCKET,
  evidencePrefix,
} from '@/app/api/admin/verification/_lib/evidence'

/**
 * Step 2 of an evidence upload: after the browser uploaded to the signed URL,
 * record a verification_evidence row. Body: { checkKey, path, note? }.
 */
export async function POST(
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
  const { checkKey, path } = body
  const note =
    typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : null

  if (typeof checkKey !== 'string' || !CHECK_KEY_RE.test(checkKey)) {
    return NextResponse.json({ error: 'Invalid checklist item' }, { status: 400 })
  }
  const prefix = evidencePrefix(contractorId, checkKey)
  if (
    typeof path !== 'string' ||
    !path.startsWith(prefix) ||
    path.includes('..') ||
    path.slice(prefix.length).includes('/')
  ) {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  // The object must actually exist (the signed upload succeeded).
  const objectName = path.slice(prefix.length)
  const { data: listed } = await adminSupabase.storage
    .from(EVIDENCE_BUCKET)
    .list(prefix.slice(0, -1), { search: objectName, limit: 1 })
  if (!listed?.some((o) => o.name === objectName)) {
    return NextResponse.json({ error: 'Upload not found — try again' }, { status: 400 })
  }

  const { data: row, error } = await adminSupabase
    .from('verification_evidence')
    .insert({
      contractor_id: contractorId,
      check_key: checkKey,
      storage_path: path,
      note,
      created_by: admin.id,
    })
    .select('id, check_key, storage_path, note, created_by, created_at')
    .single()
  if (error || !row) {
    console.error('[evidence] insert failed', error)
    return NextResponse.json({ error: 'Failed to save evidence' }, { status: 500 })
  }

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'verification_evidence_uploaded',
    targetTable: 'verification_evidence',
    targetId: row.id,
    phiAccessed: true,
    metadata: { contractorId, checkKey },
  })

  return NextResponse.json({ success: true, evidence: row })
}
