import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid, requireAdminApi } from '@/app/api/admin/_lib/guard'
import {
  CHECK_KEY_RE,
  EVIDENCE_BUCKET,
  EVIDENCE_CONTENT_TYPES,
  EVIDENCE_MAX_BYTES,
  evidencePrefix,
  safeFilename,
} from '@/app/api/admin/verification/_lib/evidence'

/**
 * Step 1 of an evidence upload: issue a one-time signed upload URL for
 * `{contractorId}/{checkKey}/{uuid}-{filename}` in the private evidence
 * bucket. The browser uploads directly (no serverless body-size limit), then
 * calls POST ../evidence to record the row.
 * Body: { checkKey, filename, contentType, size }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error

  const { contractorId } = await params
  if (!isUuid(contractorId)) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { checkKey, filename, contentType, size } = body
  if (typeof checkKey !== 'string' || !CHECK_KEY_RE.test(checkKey)) {
    return NextResponse.json({ error: 'Invalid checklist item' }, { status: 400 })
  }
  if (typeof filename !== 'string' || !filename.trim()) {
    return NextResponse.json({ error: 'Missing filename' }, { status: 400 })
  }
  if (typeof contentType !== 'string' || !EVIDENCE_CONTENT_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: 'Upload a screenshot (PNG, JPG, WebP, GIF) or a PDF.' },
      { status: 400 }
    )
  }
  if (typeof size !== 'number' || size <= 0 || size > EVIDENCE_MAX_BYTES) {
    return NextResponse.json({ error: 'File must be 15 MB or smaller.' }, { status: 400 })
  }

  const path = `${evidencePrefix(contractorId, checkKey)}${randomUUID()}-${safeFilename(filename)}`

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[evidence] createSignedUploadUrl failed', error)
    return NextResponse.json({ error: 'Could not start the upload' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token, bucket: EVIDENCE_BUCKET })
}
