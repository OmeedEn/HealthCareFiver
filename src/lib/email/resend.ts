/**
 * Resend Email Integration
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 *
 * Used to notify providers about the outcome of their admin
 * verification review (approved / more info needed / rejected).
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

/**
 * Sent when an admin approves a provider's verification review. Links to
 * /go-live, where they accept the contractor agreement and set up payouts.
 *
 * `appUrl` should be NEXT_PUBLIC_APP_URL (callers fall back to the request
 * origin) — emails need absolute links.
 */
export async function sendProviderApprovalEmail(
  provider: ProviderEmailContext,
  appUrl: string
): Promise<SendEmailResponse> {
  const goLiveUrl = `${normalizeAppUrl(appUrl)}/go-live`
  const firstName = escapeHtml(provider.firstName || 'there')

  return sendEmail({
    to: provider.email,
    subject: APPROVAL_EMAIL_SUBJECT,
    html: layout(`
      <h1 style="font-size:24px;font-weight:800;margin:0 0 16px;color:#111827;">You&#39;re live on Sanus.</h1>
      <p>Hi ${firstName},</p>
      <p>Congratulations — our team has reviewed and approved your credentials. Welcome to Sanus.</p>
      <p>Two quick steps to finish going live:</p>
      <ol style="padding-left:20px;">
        <li>Accept the Independent Contractor and Platform Agreement.</li>
        <li>Set up payouts through Stripe so you can get paid for your bookings.</li>
      </ol>
      ${ctaButton(goLiveUrl, 'Finish going live')}
      <p style="color:#62646a;font-size:13px;">Free to join. A small service fee applies to each booking.</p>
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
