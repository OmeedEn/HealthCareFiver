import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentUser, requireRole } from '@/lib/auth/roles'
import { audit } from '@/lib/audit/log'
import { sendBAAEnvelope } from '@/lib/integrations/docusign'
import { sendProviderApprovalEmail, sendVerificationActionEmail } from '@/lib/email/resend'

type Action = 'approve' | 'request_info' | 'reject'

const STATUS_BY_ACTION: Record<Action, string> = {
  approve: 'approved',
  request_info: 'more_info_requested',
  reject: 'rejected',
}

const NOTIFICATION_TYPE_BY_ACTION: Record<Action, string> = {
  approve: 'verification_approved',
  request_info: 'verification_more_info_requested',
  reject: 'verification_rejected',
}

const NOTIFICATION_TITLE_BY_ACTION: Record<Action, string> = {
  approve: "You're approved on Sanus",
  request_info: 'More information needed',
  reject: 'Verification update',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  const rawUser = await currentUser()
  let admin
  try {
    admin = requireRole(rawUser, 'admin')
  } catch {
    return NextResponse.json(
      { error: rawUser ? 'Forbidden' : 'Unauthorized' },
      { status: rawUser ? 403 : 401 }
    )
  }

  const { contractorId } = await params
  const body = await request.json().catch(() => ({}))
  const action = body.action as Action
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  if (!Object.keys(STATUS_BY_ACTION).includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if ((action === 'request_info' || action === 'reject') && !notes) {
    return NextResponse.json(
      { error: 'Notes are required for this action' },
      { status: 400 }
    )
  }

  const adminSupabase = createAdminClient()

  const { data: contractor, error: contractorError } = await adminSupabase
    .from('contractor_profiles')
    .select('id, first_name, last_name, verification_status')
    .eq('id', contractorId)
    .single()

  if (contractorError || !contractor) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  }

  const { data: profileRow } = await adminSupabase
    .from('profiles')
    .select('email')
    .eq('id', contractorId)
    .single()

  const email = profileRow?.email ?? null
  const now = new Date().toISOString()
  const newStatus = STATUS_BY_ACTION[action]

  const { error: updateError } = await adminSupabase
    .from('contractor_profiles')
    .update({
      verification_status: newStatus,
      verification_reviewed_by: admin.id,
      verification_reviewed_at: now,
      verification_notes: notes || null,
    })
    .eq('id', contractorId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update verification status' },
      { status: 500 }
    )
  }

  await adminSupabase.from('admin_audit_log').insert({
    admin_id: admin.id,
    action: `verification_${action}`,
    entity_type: 'contractor_profiles',
    entity_id: contractorId,
    old_value: { verification_status: contractor.verification_status },
    new_value: { verification_status: newStatus },
    notes: notes || null,
  })

  await adminSupabase.from('notifications').insert({
    user_id: contractorId,
    type: NOTIFICATION_TYPE_BY_ACTION[action],
    title: NOTIFICATION_TITLE_BY_ACTION[action],
    body: notes || null,
  })

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: `verification_${action}`,
    targetTable: 'contractor_profiles',
    targetId: contractorId,
    phiAccessed: true,
    metadata: { newStatus },
  })

  // Side-effect emails/envelopes are best-effort: a failure here shouldn't
  // undo the review decision, but should be surfaced to the admin.
  const warnings: string[] = []

  if (!email) {
    warnings.push('Provider has no email on file — no notification email was sent.')
  } else if (action === 'approve') {
    const name = `${contractor.first_name} ${contractor.last_name}`.trim()

    try {
      await sendBAAEnvelope({ name, email })
      await adminSupabase
        .from('contractor_profiles')
        .update({ baa_sent_at: new Date().toISOString() })
        .eq('id', contractorId)
    } catch (err) {
      console.error('[verification] Failed to send BAA envelope', err)
      warnings.push('Failed to send the BAA envelope via DocuSign.')
    }

    try {
      await sendProviderApprovalEmail({
        firstName: contractor.first_name,
        lastName: contractor.last_name,
        email,
      })
      await adminSupabase
        .from('contractor_profiles')
        .update({ approval_email_sent_at: new Date().toISOString() })
        .eq('id', contractorId)
    } catch (err) {
      console.error('[verification] Failed to send approval email', err)
      warnings.push('Failed to send the approval email.')
    }
  } else {
    try {
      await sendVerificationActionEmail(
        { firstName: contractor.first_name, lastName: contractor.last_name, email },
        action === 'request_info' ? 'more_info_requested' : 'rejected',
        notes
      )
    } catch (err) {
      console.error('[verification] Failed to send verification action email', err)
      warnings.push('Failed to send the notification email.')
    }
  }

  return NextResponse.json({ success: true, status: newStatus, warnings })
}
