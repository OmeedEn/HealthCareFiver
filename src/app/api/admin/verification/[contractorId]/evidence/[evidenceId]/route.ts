import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit/log'
import { isUuid, requireAdminApi } from '@/app/api/admin/_lib/guard'
import { EVIDENCE_BUCKET } from '@/app/api/admin/verification/_lib/evidence'

const SIGNED_URL_TTL_SECONDS = 60

/** View one evidence file: admin-only redirect to a short-lived signed URL. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contractorId: string; evidenceId: string }> }
) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const admin = guard.admin

  const { contractorId, evidenceId } = await params
  if (!isUuid(contractorId) || !isUuid(evidenceId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const adminSupabase = createAdminClient()
  const { data: row } = await adminSupabase
    .from('verification_evidence')
    .select('id, contractor_id, storage_path')
    .eq('id', evidenceId)
    .maybeSingle()
  if (!row || row.contractor_id !== contractorId || !row.storage_path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: signed, error } = await adminSupabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS)
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
  }

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'verification_evidence_viewed',
    targetTable: 'verification_evidence',
    targetId: row.id,
    phiAccessed: true,
  })

  const response = NextResponse.redirect(signed.signedUrl, 302)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
