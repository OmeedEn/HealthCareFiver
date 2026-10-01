import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit/log'
import { sendBAAEnvelope } from '@/lib/integrations/docusign'
import { sendVerificationActionEmail } from '@/lib/email/resend'
import {
  applyApproval,
  clearComplianceHold,
  markInsuranceVerified,
} from '@/lib/compliance/transitions'
import { isUuid, requireAdminApi } from '@/app/api/admin/_lib/guard'

type Action =
  | 'approve'
  | 'request_info'
  | 'reject'
  | 'suspend'
  | 'unsuspend'
  | 'mark_exclusion_screened'
  | 'verify_insurance'
  | 'clear_hold'

const ACTIONS: Action[] = [
  'approve',
  'request_info',
  'reject',
  'suspend',
  'unsuspend',
  'mark_exclusion_screened',
  'verify_insurance',
  'clear_hold',
]

const NOTES_REQUIRED: Action[] = ['request_info', 'reject', 'suspend']

/** Statuses from which an applicant can be approved for the first time. */
const APPROVABLE_FROM = ['pending_review', 'more_info_requested', 'rejected']

interface Notification {
  type: string
  title: string
  body: string | null
  href: string | null
}

const APPROVE_NOTIFICATION_BODY =
  'Accept the Independent Contractor and Platform Agreement and set up payouts to finish going live.'

/**
 * Admin decisions on a provider application. Every action is admin-only
 * (MFA-gated via currentUser()) and audit-logged.
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
  const action = body.action as Action
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 5000) : ''

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (NOTES_REQUIRED.includes(action) && !notes) {
    return NextResponse.json(
      { error: action === 'suspend' ? 'A reason is required to suspend' : 'Notes are required for this action' },
      { status: 400 }
    )
  }

  const adminSupabase = createAdminClient()

  const { data: contractor, error: contractorError } = await adminSupabase
    .from('contractor_profiles')
    .select(
      'id, first_name, last_name, verification_status, approved_at, offers_high_risk_services, insured_verified_at'
    )
    .eq('id', contractorId)
    .single()

  if (contractorError || !contractor) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  }

  const oldStatus: string = contractor.verification_status
  const now = new Date().toISOString()
  const warnings: string[] = []
  let newStatus: string = oldStatus
  let notification: Notification | null = null
  const extra: Record<string, unknown> = {}

  // Records who decided and why — shared by every status-changing action.
  async function stampReview(fields: Record<string, unknown>) {
    return adminSupabase
      .from('contractor_profiles')
      .update({
        ...fields,
        verification_reviewed_by: admin.id,
        verification_reviewed_at: now,
      })
      .eq('id', contractorId)
  }

  switch (action) {
    case 'approve': {
      if (!APPROVABLE_FROM.includes(oldStatus)) {
        return NextResponse.json(
          {
            error:
              oldStatus === 'suspended'
                ? 'Provider is suspended — use Unsuspend instead.'
                : 'Provider is already approved.',
          },
          { status: 409 }
        )
      }
      const { error } = await stampReview({ verification_notes: notes || null })
      if (error) return failed('Failed to record the review')

      // applyApproval decides approved vs insurance_pending, sets approved_at
      // / insurance_due_at, and sends the "You're live on Sanus" email.
      try {
        const result = await applyApproval(adminSupabase, contractorId)
        newStatus = result.status
        extra.insuranceDueAt = result.insuranceDueAt
      } catch (err) {
        console.error('[verification] applyApproval failed', err)
        return failed('Approval failed — the provider was not approved. Try again.')
      }

      notification = {
        type: 'verification_approved',
        title: "You're live on Sanus.",
        body: notes || APPROVE_NOTIFICATION_BODY,
        href: '/go-live',
      }
      break
    }

    case 'request_info':
    case 'reject': {
      newStatus = action === 'request_info' ? 'more_info_requested' : 'rejected'
      const { error } = await stampReview({
        verification_status: newStatus,
        verification_notes: notes,
      })
      if (error) return failed('Failed to update verification status')
      notification =
        action === 'request_info'
          ? {
              type: 'verification_more_info_requested',
              title: 'More information needed',
              body: notes,
              href: '/contractor/credentials/upload',
            }
          : { type: 'verification_rejected', title: 'Verification update', body: notes, href: null }
      break
    }

    case 'suspend': {
      if (oldStatus === 'suspended') {
        return NextResponse.json({ error: 'Provider is already suspended.' }, { status: 409 })
      }
      newStatus = 'suspended'
      const { error } = await stampReview({
        verification_status: newStatus,
        verification_notes: notes,
      })
      if (error) return failed('Failed to suspend provider')
      notification = {
        type: 'verification_suspended',
        title: 'Your Sanus account is suspended',
        body: 'Your profile and listings are hidden while we review your account. We will contact you by email.',
        href: null,
      }
      break
    }

    case 'unsuspend': {
      if (oldStatus !== 'suspended') {
        return NextResponse.json({ error: 'Provider is not suspended.' }, { status: 409 })
      }
      if (!contractor.approved_at) {
        // Never approved before: this is effectively a first approval.
        const { error } = await stampReview({ verification_notes: notes || null })
        if (error) return failed('Failed to record the review')
        try {
          const result = await applyApproval(adminSupabase, contractorId)
          newStatus = result.status
          extra.insuranceDueAt = result.insuranceDueAt
        } catch (err) {
          console.error('[verification] applyApproval failed', err)
          return failed('Unsuspend failed. Try again.')
        }
      } else {
        // Restore the live status they had: insurance pending only if their
        // services need malpractice and no certificate has been reviewed.
        newStatus =
          contractor.offers_high_risk_services && !contractor.insured_verified_at
            ? 'insurance_pending'
            : 'approved'
        const { error } = await stampReview({
          verification_status: newStatus,
          verification_notes: notes || null,
        })
        if (error) return failed('Failed to unsuspend provider')
        if (newStatus === 'insurance_pending') {
          warnings.push(
            'Restored to Insurance pending — the original insurance deadline was kept.'
          )
        }
      }
      notification = {
        type: 'verification_reinstated',
        title: 'Your Sanus account is active again',
        body: null,
        href: '/dashboard',
      }
      break
    }

    case 'mark_exclusion_screened': {
      const { error } = await adminSupabase
        .from('contractor_profiles')
        .update({ last_exclusion_check_at: now })
        .eq('id', contractorId)
      if (error) return failed('Failed to record the exclusion screening')
      extra.lastExclusionCheckAt = now
      break
    }

    case 'clear_hold': {
      // Refuses while the lapse still applies (the daily cron would re-set
      // it); `force` clears it anyway for manual holds the admin resolved.
      let result
      try {
        result = await clearComplianceHold(adminSupabase, contractorId, {
          force: body.force === true,
        })
      } catch (err) {
        console.error('[verification] clearComplianceHold failed', err)
        return failed('Failed to clear the compliance hold')
      }
      if (!result.cleared) {
        return NextResponse.json(
          {
            error: `Hold still applies: ${result.blockingReason}. Verify a current document or fix the expiration date first.`,
          },
          { status: 409 }
        )
      }
      break
    }

    case 'verify_insurance': {
      const credentialId = body.credentialId
      if (!isUuid(credentialId)) {
        return NextResponse.json({ error: 'Choose a malpractice certificate' }, { status: 400 })
      }
      const { data: cred } = await adminSupabase
        .from('credentials')
        .select('id, contractor_id, credential_type, expiration_date')
        .eq('id', credentialId)
        .maybeSingle()
      if (
        !cred ||
        cred.contractor_id !== contractorId ||
        cred.credential_type !== 'malpractice_insurance'
      ) {
        return NextResponse.json({ error: 'Malpractice certificate not found' }, { status: 404 })
      }
      if (cred.expiration_date && cred.expiration_date < now.slice(0, 10)) {
        return NextResponse.json(
          { error: 'This certificate has expired — ask the provider for a current one.' },
          { status: 409 }
        )
      }
      const { error: credError } = await adminSupabase
        .from('credentials')
        .update({ status: 'verified', verified_at: now, verified_by: admin.id })
        .eq('id', credentialId)
      if (credError) return failed('Failed to verify the certificate')

      try {
        await markInsuranceVerified(adminSupabase, contractorId)
      } catch (err) {
        console.error('[verification] markInsuranceVerified failed', err)
        return failed(
          'The certificate was marked verified, but updating the provider’s insurance status failed. Try again.'
        )
      }
      const { data: after } = await adminSupabase
        .from('contractor_profiles')
        .select('verification_status')
        .eq('id', contractorId)
        .single()
      newStatus = after?.verification_status ?? oldStatus
      extra.credentialId = credentialId
      notification = {
        type: 'insurance_verified',
        title: 'Malpractice coverage verified',
        body: 'Your Insured badge is on, and listings that need coverage can now be published.',
        href: '/dashboard',
      }
      break
    }
  }

  await adminSupabase.from('admin_audit_log').insert({
    admin_id: admin.id,
    action: `verification_${action}`,
    entity_type: 'contractor_profiles',
    entity_id: contractorId,
    old_value: { verification_status: oldStatus },
    new_value: { verification_status: newStatus, ...extra },
    notes: notes || null,
  })

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: `verification_${action}`,
    targetTable: 'contractor_profiles',
    targetId: contractorId,
    phiAccessed: true,
    metadata: { oldStatus, newStatus, ...extra },
  })

  if (notification) {
    const { error: notificationError } = await adminSupabase.from('notifications').insert({
      user_id: contractorId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.href ? { href: notification.href } : null,
    })
    if (notificationError) {
      console.error('[verification] Failed to create notification', notificationError)
    }
  }

  // Side-effect emails/envelopes are best-effort: a failure here shouldn't
  // undo the review decision, but should be surfaced to the admin.
  if (action === 'approve' || action === 'request_info' || action === 'reject') {
    const { data: profileRow } = await adminSupabase
      .from('profiles')
      .select('email')
      .eq('id', contractorId)
      .single()
    const email = profileRow?.email ?? null

    if (!email) {
      warnings.push('Provider has no email on file — no email was sent.')
    } else if (action === 'approve') {
      // The approval email itself is sent by applyApproval — only the BAA here.
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
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
      try {
        await sendVerificationActionEmail(
          { firstName: contractor.first_name, lastName: contractor.last_name, email },
          action === 'request_info' ? 'more_info_requested' : 'rejected',
          notes,
          appUrl
        )
      } catch (err) {
        console.error('[verification] Failed to send verification action email', err)
        warnings.push('Failed to send the notification email.')
      }
    }
  }

  return NextResponse.json({ success: true, status: newStatus, warnings, ...extra })
}

function failed(message: string) {
  return NextResponse.json({ error: message }, { status: 500 })
}
