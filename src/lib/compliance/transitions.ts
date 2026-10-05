import type { SupabaseClient } from '@supabase/supabase-js'
import { sendInsuranceVerifiedEmail, sendProviderApprovalEmail } from '@/lib/email/resend'
import { graceDeadline, LIVE_VERIFICATION_STATUSES } from './config'
import {
  findHoldLapse,
  hasCurrentMalpractice,
  isAutomatedHold,
  type CredentialRow,
} from './rules'
import { loadProviderContacts, notify, resolveAppUrl, sendSafely } from './notify'

/**
 * Provider compliance state transitions. Server only: pass the service-role
 * client (createAdminClient()) — these write protected columns.
 *
 * Holds (contractor_profiles.compliance_hold_reason):
 *   - The daily compliance cron sets an *automated* hold when a license,
 *     certification, government ID, or the self-reported license expiration
 *     date lapses. Automated reasons start with HOLD_REASON_PREFIX.
 *   - An automated hold is cleared by applyApproval / clearComplianceHold once
 *     the lapse no longer applies (a current verified credential is on file,
 *     or license_expiration_date was updated). If the lapse still applies the
 *     cron would just re-set it, so it is kept.
 *   - Any other (manual) hold is only cleared by clearComplianceHold.
 */

type ProviderRow = {
  id: string
  verification_status: string | null
  offers_high_risk_services: boolean | null
  approved_at: string | null
  insurance_due_at: string | null
  insured_verified_at: string | null
  compliance_hold_reason: string | null
  license_expiration_date: string | null
}

const PROVIDER_COLUMNS =
  'id, verification_status, offers_high_risk_services, approved_at, insurance_due_at, insured_verified_at, compliance_hold_reason, license_expiration_date'

const APPROVE_NOTIFICATION_BODY =
  'Accept the Independent Contractor and Platform Agreement and set up payouts to finish going live.'

async function loadProvider(admin: SupabaseClient, contractorId: string): Promise<ProviderRow> {
  const { data, error } = await admin
    .from('contractor_profiles')
    .select(PROVIDER_COLUMNS)
    .eq('id', contractorId)
    .single()
  if (error || !data) {
    throw new Error(`Provider ${contractorId} not found: ${error?.message ?? 'no row'}`)
  }
  return data as ProviderRow
}

async function loadComplianceCredentials(
  admin: SupabaseClient,
  contractorId: string
): Promise<CredentialRow[]> {
  const { data, error } = await admin
    .from('credentials')
    .select('id, contractor_id, credential_type, name, status, expiration_date')
    .eq('contractor_id', contractorId)
    .in('credential_type', ['license', 'certification', 'government_id', 'malpractice_insurance'])
  if (error) throw new Error(`Failed to load credentials: ${error.message}`)
  return (data ?? []) as CredentialRow[]
}

/** Same rule as SQL is_insured(uuid): badge set AND a current verified certificate. */
function isInsured(provider: ProviderRow, creds: CredentialRow[], now: Date): boolean {
  return provider.insured_verified_at !== null && hasCurrentMalpractice(creds, now)
}

export type ApprovalOptions = {
  /** Base URL for email links when NEXT_PUBLIC_APP_URL is unset (e.g. request origin). */
  appUrl?: string
  /** Shown as the in-app notification body instead of the default copy. */
  notes?: string | null
}

/**
 * Approve a provider.
 *
 *  - status: 'insurance_pending' when offers_high_risk_services and not
 *    insured (same logic as SQL is_insured), else 'approved'.
 *  - approved_at: set on first approval; a re-approval keeps the original.
 *  - insurance_due_at (pending only): an existing deadline is kept (never
 *    extended); otherwise approved_at + MALPRACTICE_GRACE_DAYS on first
 *    approval, or now + MALPRACTICE_GRACE_DAYS when a re-approval newly
 *    needs coverage (the clock starts at the approval that requires it).
 *    Cleared when not pending.
 *  - compliance_hold_reason: an automated lapse hold is cleared if the lapse
 *    no longer applies; manual holds are left for clearComplianceHold.
 *  - "You're live on Sanus" email + in-app notification, only on the
 *    transition into a live status (a repeat approve doesn't re-send).
 *    Email failures are logged, never thrown.
 *
 * The caller (admin route) still records verification_reviewed_by/_at/notes,
 * the audit log, and the BAA envelope. Throws only on DB errors.
 */
export async function applyApproval(
  admin: SupabaseClient,
  contractorId: string,
  options: ApprovalOptions = {}
): Promise<{ status: 'approved' | 'insurance_pending'; insuranceDueAt: string | null }> {
  const now = new Date()
  const provider = await loadProvider(admin, contractorId)
  const creds = await loadComplianceCredentials(admin, contractorId)

  const wasLive = (LIVE_VERIFICATION_STATUSES as readonly string[]).includes(
    provider.verification_status ?? ''
  )
  const needsInsurance =
    provider.offers_high_risk_services === true && !isInsured(provider, creds, now)
  const status: 'approved' | 'insurance_pending' = needsInsurance ? 'insurance_pending' : 'approved'

  const approvedAt = provider.approved_at ?? now.toISOString()
  let insuranceDueAt: string | null = null
  if (needsInsurance) {
    // First approval: approvedAt === now. Re-approval: clock starts now.
    insuranceDueAt = provider.insurance_due_at ?? graceDeadline(now).toISOString()
  }

  let holdReason = provider.compliance_hold_reason
  if (isAutomatedHold(holdReason) && !findHoldLapse(provider, creds, now)) {
    holdReason = null
  }

  const { error: updateError } = await admin
    .from('contractor_profiles')
    .update({
      verification_status: status,
      approved_at: approvedAt,
      insurance_due_at: insuranceDueAt,
      compliance_hold_reason: holdReason,
    })
    .eq('id', contractorId)
  if (updateError) throw new Error(`Failed to approve provider: ${updateError.message}`)

  if (!wasLive) {
    const appUrl = resolveAppUrl(options.appUrl)
    await notify(admin, {
      userId: contractorId,
      type: 'verification_approved',
      title: "You're live on Sanus.",
      body: options.notes || APPROVE_NOTIFICATION_BODY,
      href: '/go-live',
    })

    const contacts = await loadProviderContacts(admin, [contractorId])
    const sent = await sendSafely("You're live on Sanus", contacts.get(contractorId), (to) =>
      sendProviderApprovalEmail(to, appUrl, { insuranceDueAt })
    )
    if (sent) {
      const { error } = await admin
        .from('contractor_profiles')
        .update({ approval_email_sent_at: new Date().toISOString() })
        .eq('id', contractorId)
      if (error) console.error('[compliance] Failed to stamp approval_email_sent_at', error)
    }
  }

  return { status, insuranceDueAt }
}

/**
 * Call after an admin verifies a malpractice_insurance credential.
 *
 *  - insured_verified_at = now (turns the Insured badge on), insurance_due_at cleared
 *  - insurance_pending → approved (other statuses unchanged)
 *  - an insurance-related hold (reason mentioning malpractice/insurance) is cleared
 *  - 'paused' offerings that require malpractice go back to 'pending_review'
 *    for admin listing review (not straight to published)
 *  - "Your malpractice certificate is verified" email + in-app notification
 *
 * Throws only on DB errors; email failures are logged.
 */
export async function markInsuranceVerified(
  admin: SupabaseClient,
  contractorId: string,
  options: { appUrl?: string } = {}
): Promise<{ status: string | null; resumedOfferings: number }> {
  const provider = await loadProvider(admin, contractorId)
  const nowIso = new Date().toISOString()

  const status =
    provider.verification_status === 'insurance_pending' ? 'approved' : provider.verification_status
  const insuranceHold =
    provider.compliance_hold_reason !== null &&
    /malpractice|insurance/i.test(provider.compliance_hold_reason)

  const { error: updateError } = await admin
    .from('contractor_profiles')
    .update({
      insured_verified_at: nowIso,
      insurance_due_at: null,
      verification_status: status,
      ...(insuranceHold ? { compliance_hold_reason: null } : {}),
    })
    .eq('id', contractorId)
  if (updateError) throw new Error(`Failed to mark insurance verified: ${updateError.message}`)

  const { data: resumed, error: resumeError } = await admin
    .from('professional_offerings')
    .update({ status: 'pending_review' })
    .eq('contractor_id', contractorId)
    .eq('status', 'paused')
    .eq('requires_malpractice', true)
    .select('id')
  if (resumeError) console.error('[compliance] Failed to resume paused offerings', resumeError)
  const resumedOfferings = resumed?.length ?? 0

  await notify(admin, {
    userId: contractorId,
    type: 'credential_verified',
    title: 'Your malpractice certificate is verified',
    body:
      resumedOfferings > 0
        ? `Your Insured badge is on. ${resumedOfferings} paused listing${resumedOfferings === 1 ? ' is' : 's are'} back in review.`
        : 'Your Insured badge is on, and you can publish hands-on, home-visit, prescribing, injectable, and IV listings.',
    href: '/dashboard',
  })

  const contacts = await loadProviderContacts(admin, [contractorId])
  await sendSafely('Malpractice certificate verified', contacts.get(contractorId), (to) =>
    sendInsuranceVerifiedEmail(to, resolveAppUrl(options.appUrl), resumedOfferings)
  )

  return { status, resumedOfferings }
}

/**
 * Admin "Clear hold" action. Re-checks lapses first: if a license,
 * certification, ID, or license_expiration_date is still expired, the hold is
 * NOT cleared (the cron would re-apply it) and the blocking reason is
 * returned — the admin must verify a current credential or correct
 * license_expiration_date first. Pass `force: true` to clear anyway (e.g. a
 * data-entry error the admin has confirmed); the next cron run re-holds if a
 * lapse still exists.
 */
export async function clearComplianceHold(
  admin: SupabaseClient,
  contractorId: string,
  options: { force?: boolean } = {}
): Promise<{ cleared: boolean; blockingReason: string | null }> {
  const now = new Date()
  const provider = await loadProvider(admin, contractorId)
  if (!provider.compliance_hold_reason) return { cleared: true, blockingReason: null }

  if (!options.force) {
    const creds = await loadComplianceCredentials(admin, contractorId)
    const lapse = findHoldLapse(provider, creds, now)
    if (lapse) return { cleared: false, blockingReason: lapse.holdReason }
  }

  const { error } = await admin
    .from('contractor_profiles')
    .update({ compliance_hold_reason: null })
    .eq('id', contractorId)
  if (error) throw new Error(`Failed to clear compliance hold: ${error.message}`)
  return { cleared: true, blockingReason: null }
}

/**
 * A provider saved a listing that needs malpractice coverage (in-person, home
 * visit, or medical procedures) but said "no" to the practice question in
 * onboarding. Record that they now offer high-risk services, and if they're
 * already approved and not insured, start the same grace period approval
 * would have: status 'insurance_pending' with a deadline (an existing one is
 * kept, never extended), which drives the banner, reminders and auto-pause.
 *
 * No-op when they already declared high-risk services. Pass the service-role
 * client. Returns the deadline when a grace period was started.
 */
export async function startInsuranceGraceForListing(
  admin: SupabaseClient,
  contractorId: string
): Promise<{ insuranceDueAt: string | null }> {
  const now = new Date()
  const provider = await loadProvider(admin, contractorId)
  if (provider.offers_high_risk_services === true) return { insuranceDueAt: null }

  const creds = await loadComplianceCredentials(admin, contractorId)
  const update: Record<string, unknown> = { offers_high_risk_services: true }
  let insuranceDueAt: string | null = null

  if (provider.verification_status === 'approved' && !isInsured(provider, creds, now)) {
    insuranceDueAt = provider.insurance_due_at ?? graceDeadline(now).toISOString()
    update.verification_status = 'insurance_pending'
    update.insurance_due_at = insuranceDueAt
  }

  const { error } = await admin.from('contractor_profiles').update(update).eq('id', contractorId)
  if (error) throw new Error(`Failed to start insurance grace period: ${error.message}`)

  if (insuranceDueAt) {
    await notify(admin, {
      userId: contractorId,
      type: 'system',
      title: 'Malpractice coverage needed for this listing',
      body: `In-person, home-visit, prescribing, injectable and IV listings need professional liability insurance. Upload your certificate by ${new Date(insuranceDueAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} to publish them. Your other listings aren't affected.`,
      href: '/contractor/credentials/upload?type=malpractice_insurance',
    })
  }
  return { insuranceDueAt }
}
