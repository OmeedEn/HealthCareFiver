import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit/log'
import {
  CREDENTIALS_BUCKET,
  credentialStoragePath,
} from '@/lib/credentials/document'

// Long enough to load an <img>/<iframe> or open a tab; short enough that a
// leaked link is useless soon after.
const SIGNED_URL_TTL_SECONDS = 60

/**
 * View a credential document. Only the owning contractor or an admin may view
 * it (currentUser() also enforces AAL2/MFA). Redirects to a short-lived signed
 * URL for the object in the private `credentials` bucket.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const adminSupabase = createAdminClient()

  const { data: credential } = await adminSupabase
    .from('credentials')
    .select('id, contractor_id, document_url')
    .eq('id', id)
    .maybeSingle()

  // 404 (not 403) for other people's credentials so ids can't be probed.
  if (
    !credential ||
    (user.role !== 'admin' && credential.contractor_id !== user.id)
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const path = credentialStoragePath(credential.document_url)
  if (!path) {
    return NextResponse.json({ error: 'No document' }, { status: 404 })
  }

  const { data: signed, error } = await adminSupabase.storage
    .from(CREDENTIALS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Document unavailable' }, { status: 404 })
  }

  await audit({
    actorId: user.id,
    actorRole: user.role,
    action: 'credential_document_viewed',
    targetTable: 'credentials',
    targetId: credential.id,
    phiAccessed: true,
  })

  const response = NextResponse.redirect(signed.signedUrl, 302)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
