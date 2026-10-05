/**
 * Resend Email Integration
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 *
 * Used to notify providers about the outcome of their admin
 * verification review (approved / more info needed / rejected) and about
 * compliance lifecycle events (malpractice grace period, expiring or lapsed
 * credentials), plus the admin exclusion re-screen digest.
 *
 * Without RESEND_API_KEY every send is a logged no-op. Callers must treat
 * send failures as non-fatal (an unverified sending domain makes Resend 4xx).
 */

const RESEND_API_URL = 'https://api.resend.com/emails'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailRequest {
  to: string
  subject: string
  html: string
}

export interface SendEmailResponse {
  id: string
}

export interface ProviderEmailContext {
  firstName: string
  lastName: string
  email: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string | null {
  return process.env.RESEND_API_KEY || null
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || 'Sanus <notifications@sanus.com>'
}

// ---------------------------------------------------------------------------
// Mock response (used when API key is not configured)
// ---------------------------------------------------------------------------

function mockSendEmail(request: SendEmailRequest): SendEmailResponse {
  console.warn(
    `[Resend] API key not set — would send "${request.subject}" to ${request.to}`
  )
  return { id: `mock_email_${Date.now()}` }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return mockSendEmail(request)
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [request.to],
      subject: request.subject,
      html: request.html,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend API error (${response.status}): ${body}`)
  }

  return response.json()
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip trailing slashes so `${appUrl}/path` never doubles up. */
function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/+$/, '')
}

function ctaButton(href: string, label: string): string {
  return `
      <p style="margin:24px 0;">
        <a href="${escapeHtml(href)}"
           style="display:inline-block;background:#1dbf73;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;">
          ${escapeHtml(label)}
        </a>
      </p>`
}

function layout(body: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#404145;font-size:15px;line-height:1.6;max-width:560px;">
      ${body}
      <p style="margin-top:28px;">The Sanus Team</p>
    </div>`
}

export const APPROVAL_EMAIL_SUBJECT = "You're live on Sanus."

/** Listing types that need a reviewed malpractice certificate. */
const HIGH_RISK_LISTINGS_PHRASE =
  'in-person or hands-on care, home visits, prescribing, injectables, and IVs'

function formatEmailDate(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function uploadUrl(appUrl: string): string {
  return `${normalizeAppUrl(appUrl)}/contractor/credentials/upload`
}

function greeting(provider: ProviderEmailContext): string {
  return `<p>Hi ${escapeHtml(provider.firstName || 'there')},</p>`
}

export interface ApprovalEmailOptions {
  /**
   * Set when the provider was approved as "Insurance pending": the ISO
   * timestamp their malpractice grace period ends.
   */
  insuranceDueAt?: string | null
}

/**
 * "You're live on Sanus." — sent when an admin approves a provider's
 * verification review (via applyApproval in src/lib/compliance/transitions).
 * Links to /go-live, where they accept the contractor agreement and set up
 * payouts. When approved as Insurance pending, the email also gives the
 * malpractice deadline and which listings stay unpublished until then.
 *
 * `appUrl` should be NEXT_PUBLIC_APP_URL (callers fall back to the request
 * origin) — emails need absolute links.
 */
export async function sendProviderApprovalEmail(
  provider: ProviderEmailContext,
  appUrl: string,
  options: ApprovalEmailOptions = {}
): Promise<SendEmailResponse> {
  const goLiveUrl = `${normalizeAppUrl(appUrl)}/go-live`
  const insuranceBlock = options.insuranceDueAt
    ? `
      <div style="margin:20px 0;padding:14px 16px;background:#fffbeb;border-left:3px solid #f59e0b;">
        <p style="margin:0 0 8px;"><strong>Malpractice coverage due by ${escapeHtml(formatEmailDate(options.insuranceDueAt))}.</strong></p>
        <p style="margin:0;">The services you selected require professional liability (malpractice) insurance. You have 30 days after approval to upload your certificate. Until our team reviews it, listings for ${HIGH_RISK_LISTINGS_PHRASE} stay unpublished. You can publish consulting, telehealth or virtual advisory, and educational listings now.</p>
        <p style="margin:8px 0 0;"><a href="${escapeHtml(uploadUrl(appUrl))}" style="color:#0f8f56;font-weight:700;">Upload your certificate</a></p>
      </div>`
    : ''

  return sendEmail({
    to: provider.email,
    subject: APPROVAL_EMAIL_SUBJECT,
    html: layout(`
      <h1 style="font-size:24px;font-weight:800;margin:0 0 16px;color:#111827;">You&#39;re live on Sanus.</h1>
      ${greeting(provider)}
      <p>Congratulations — our team has reviewed and approved your credentials. Welcome to Sanus.</p>
      <p>Two quick steps to finish going live:</p>
      <ol style="padding-left:20px;">
        <li>Accept the Independent Contractor and Platform Agreement — required before your first listing is published.</li>
        <li>Set up payouts through Stripe Connect so you can get paid for your bookings.</li>
      </ol>
      ${insuranceBlock}
      ${ctaButton(goLiveUrl, 'Finish going live')}
      <p style="color:#62646a;font-size:13px;">Free to join. A small service fee applies to each booking.</p>
    `),
  })
}

/** Sent when an admin verifies a provider's malpractice certificate. */
export async function sendInsuranceVerifiedEmail(
  provider: ProviderEmailContext,
  appUrl: string,
  resumedListings: number
): Promise<SendEmailResponse> {
  const resumed =
    resumedListings > 0
      ? `<p>${resumedListings} paused listing${resumedListings === 1 ? ' is' : 's are'} back in review and will go live once approved.</p>`
      : ''
  return sendEmail({
    to: provider.email,
    subject: 'Your malpractice certificate is verified',
    html: layout(`
      ${greeting(provider)}
      <p>Our team reviewed and verified your malpractice certificate. Your profile now shows the <strong>Insured</strong> badge, and you can publish listings for ${HIGH_RISK_LISTINGS_PHRASE}.</p>
      ${resumed}
      ${ctaButton(`${normalizeAppUrl(appUrl)}/dashboard`, 'Go to dashboard')}
    `),
  })
}

/** Malpractice grace-period reminder (14, 7, 1 days left). */
export async function sendInsuranceGraceReminderEmail(
  provider: ProviderEmailContext,
  appUrl: string,
  daysLeft: number,
  dueAt: string
): Promise<SendEmailResponse> {
  const left = `${daysLeft} day${daysLeft === 1 ? '' : 's'}`
  return sendEmail({
    to: provider.email,
    subject: `${left} left to upload your malpractice certificate`,
    html: layout(`
      ${greeting(provider)}
      <p>You have <strong>${left}</strong> (until ${escapeHtml(formatEmailDate(dueAt))}) to upload your professional liability (malpractice) certificate.</p>
      <p>Listings for ${HIGH_RISK_LISTINGS_PHRASE} stay unpublished until our team reviews it. If the deadline passes without a certificate, those listings are paused. Your other listings are not affected.</p>
      ${ctaButton(uploadUrl(appUrl), 'Upload certificate')}
    `),
  })
}

/** Grace deadline passed without a reviewed certificate. */
export async function sendInsuranceDeadlinePassedEmail(
  provider: ProviderEmailContext,
  appUrl: string,
  pausedListings: number
): Promise<SendEmailResponse> {
  const paused =
    pausedListings > 0
      ? `We paused ${pausedListings} listing${pausedListings === 1 ? '' : 's'} that need${pausedListings === 1 ? 's' : ''} malpractice coverage; ${pausedListings === 1 ? 'it is' : 'they are'} hidden from clients.`
      : `Listings for ${HIGH_RISK_LISTINGS_PHRASE} can&#39;t be published until coverage is reviewed.`
  return sendEmail({
    to: provider.email,
    subject: 'Your malpractice deadline has passed',
    html: layout(`
      ${greeting(provider)}
      <p>Your 30-day window to upload a malpractice certificate has ended. ${paused}</p>
      <p>You&#39;re still live for consulting, telehealth or virtual advisory, and educational listings. Upload your certificate and, once our team reviews it, we&#39;ll reactivate the paused listings.</p>
      ${ctaButton(uploadUrl(appUrl), 'Upload certificate')}
    `),
  })
}

/** 60 / 30-day expiry reminder for a license, certification, malpractice or ID. */
export async function sendCredentialExpiringEmail(
  provider: ProviderEmailContext,
  appUrl: string,
  credential: { label: string; expirationDate: string; daysLeft: number }
): Promise<SendEmailResponse> {
  return sendEmail({
    to: provider.email,
    subject: `Your ${credential.label} expires in ${credential.daysLeft} days`,
    html: layout(`
      ${greeting(provider)}
      <p>Your <strong>${escapeHtml(credential.label)}</strong> expires on ${escapeHtml(formatEmailDate(credential.expirationDate))}. Upload the renewed document before then so there&#39;s no interruption to your profile or listings.</p>
      ${ctaButton(uploadUrl(appUrl), 'Upload renewal')}
    `),
  })
}

/**
 * A credential lapsed. `effect`:
 *  - 'hold': license / certification / ID — hidden from search until re-verified
 *  - 'listings_paused': malpractice — Insured badge off, hands-on listings paused
 */
export async function sendCredentialLapsedEmail(
  provider: ProviderEmailContext,
  appUrl: string,
  credential: { label: string; expirationDate: string; effect: 'hold' | 'listings_paused' }
): Promise<SendEmailResponse> {
  const effect =
    credential.effect === 'hold'
      ? 'Your profile and listings are hidden from search, and you can&#39;t take new bookings, until our team verifies a current document.'
      : `Your Insured badge has been removed and listings for ${HIGH_RISK_LISTINGS_PHRASE} are paused until our team verifies a current certificate. Your other listings are not affected.`
  return sendEmail({
    to: provider.email,
    subject: `Action needed: your ${credential.label} has expired`,
    html: layout(`
      ${greeting(provider)}
      <p>Your <strong>${escapeHtml(credential.label)}</strong> expired on ${escapeHtml(formatEmailDate(credential.expirationDate))}.</p>
      <p>${effect}</p>
      ${ctaButton(uploadUrl(appUrl), 'Upload renewal')}
    `),
  })
}

export interface ExclusionDigestProvider {
  id: string
  name: string
  lastCheckedAt: string | null
}

/** Weekly admin digest: live providers due for their exclusion re-screen. */
export async function sendExclusionRescreenDigestEmail(
  to: string,
  appUrl: string,
  providers: ExclusionDigestProvider[]
): Promise<SendEmailResponse> {
  const base = normalizeAppUrl(appUrl)
  const rows = providers
    .map((p) => {
      const last = p.lastCheckedAt ? escapeHtml(formatEmailDate(p.lastCheckedAt)) : 'never'
      const href = escapeHtml(`${base}/admin/verification/${p.id}`)
      return `<li><a href="${href}" style="color:#0f8f56;">${escapeHtml(p.name || p.id)}</a> — last checked ${last}</li>`
    })
    .join('')
  return sendEmail({
    to,
    subject: `Exclusion re-screen due: ${providers.length} provider${providers.length === 1 ? '' : 's'}`,
    html: layout(`
      <p>These live providers are due for their monthly exclusion re-screen (OIG LEIE, SAM.gov, Medi-Cal Suspended &amp; Ineligible):</p>
      <ul style="padding-left:20px;">${rows}</ul>
      <p>Record each lookup (with a screenshot) on the provider&#39;s verification page.</p>
    `),
  })
}

/**
 * Sent when an admin requests more information or rejects a provider's
 * verification review.
 */
export async function sendVerificationActionEmail(
  provider: ProviderEmailContext,
  action: 'more_info_requested' | 'rejected',
  notes: string,
  appUrl: string
): Promise<SendEmailResponse> {
  const firstName = escapeHtml(provider.firstName || 'there')
  const safeNotes = escapeHtml(notes).replace(/\n/g, '<br />')

  if (action === 'more_info_requested') {
    const uploadUrl = `${normalizeAppUrl(appUrl)}/contractor/credentials/upload`
    return sendEmail({
      to: provider.email,
      subject: 'Action needed: your Sanus application',
      html: layout(`
        <p>Hi ${firstName},</p>
        <p>We need a bit more information before we can approve your application.</p>
        <p><strong>Message from our review team:</strong></p>
        <blockquote style="margin:0;padding:12px 16px;background:#f9fafb;border-left:3px solid #1dbf73;">${safeNotes}</blockquote>
        <p>Upload the requested information and we&#39;ll pick your review back up.</p>
        ${ctaButton(uploadUrl, 'Upload documents')}
      `),
    })
  }

  return sendEmail({
    to: provider.email,
    subject: 'Update on your Sanus application',
    html: layout(`
      <p>Hi ${firstName},</p>
      <p>Thank you for applying to Sanus. We&#39;re unable to approve your application at this time.</p>
      <p><strong>Message from our review team:</strong></p>
      <blockquote style="margin:0;padding:12px 16px;background:#f9fafb;border-left:3px solid #d1d5db;">${safeNotes}</blockquote>
      <p>If you have questions, just reply to this email.</p>
    `),
  })
}

// ---------------------------------------------------------------------------
// Organization verification
// ---------------------------------------------------------------------------

export interface OrgEmailContext {
  /** Person who signed up for the org (contact name or account first name). */
  contactName: string | null
  orgName: string
  email: string
}

/**
 * "You're live on Sanus." for organizations — sent when an admin approves an
 * organization (src/app/admin/organizations/actions.ts).
 */
export async function sendOrgApprovalEmail(
  org: OrgEmailContext,
  appUrl: string
): Promise<SendEmailResponse> {
  const dashboardUrl = `${normalizeAppUrl(appUrl)}/dashboard`
  return sendEmail({
    to: org.email,
    subject: APPROVAL_EMAIL_SUBJECT,
    html: layout(`
      <h1 style="font-size:24px;font-weight:800;margin:0 0 16px;color:#111827;">You&#39;re live on Sanus.</h1>
      <p>Hi ${escapeHtml(org.contactName || 'there')},</p>
      <p>Our team has reviewed and approved <strong>${escapeHtml(org.orgName)}</strong>. Welcome to Sanus.</p>
      <p>You can now message professionals and review applicants. One last step before your first listing or post goes live: accept the Organization Agreement on your dashboard, then submit your drafts for review.</p>
      ${ctaButton(dashboardUrl, 'Go to your dashboard')}
    `),
  })
}

/** Needs info / suspended / rejected, with the reviewer's message. */
export async function sendOrgReviewActionEmail(
  org: OrgEmailContext,
  action: 'needs_info' | 'suspended' | 'rejected',
  notes: string,
  appUrl: string
): Promise<SendEmailResponse> {
  const hi = `<p>Hi ${escapeHtml(org.contactName || 'there')},</p>`
  const orgName = escapeHtml(org.orgName)
  const quote = (border: string) =>
    `<p><strong>Message from our review team:</strong></p>
     <blockquote style="margin:0;padding:12px 16px;background:#f9fafb;border-left:3px solid ${border};">${escapeHtml(notes).replace(/\n/g, '<br />')}</blockquote>`

  if (action === 'needs_info') {
    return sendEmail({
      to: org.email,
      subject: 'Action needed: your Sanus organization application',
      html: layout(`
        ${hi}
        <p>We need a bit more information before we can approve <strong>${orgName}</strong>.</p>
        ${quote('#1dbf73')}
        <p>Update your organization profile and we&#39;ll pick your review back up.</p>
        ${ctaButton(`${normalizeAppUrl(appUrl)}/facility/profile`, 'Update your profile')}
      `),
    })
  }

  if (action === 'suspended') {
    return sendEmail({
      to: org.email,
      subject: 'Your Sanus organization account is suspended',
      html: layout(`
        ${hi}
        <p><strong>${orgName}</strong> has been suspended on Sanus. Your posts are hidden, and you can&#39;t message professionals or review applicants for now.</p>
        ${quote('#d1d5db')}
        <p>Reply to this email to resolve it.</p>
      `),
    })
  }

  return sendEmail({
    to: org.email,
    subject: 'Update on your Sanus organization application',
    html: layout(`
      ${hi}
      <p>Thank you for applying to Sanus. We&#39;re unable to approve <strong>${orgName}</strong> at this time.</p>
      ${quote('#d1d5db')}
      <p>If you have questions, just reply to this email.</p>
    `),
  })
}
