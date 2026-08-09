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
  return process.env.RESEND_FROM_EMAIL || 'HealthGig <notifications@healthgig.com>'
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

/**
 * Sent when an admin approves a provider's verification review.
 */
export async function sendProviderApprovalEmail(
  provider: ProviderEmailContext
): Promise<SendEmailResponse> {
  return sendEmail({
    to: provider.email,
    subject: "You're approved on HealthGig",
    html: `
      <p>Hi ${provider.firstName},</p>
      <p>Good news — your HealthGig provider verification has been approved. Your profile is now live and visible to facilities, and you can apply to open shifts.</p>
      <p>You'll also receive a separate email shortly to review and sign our Business Associate Agreement (BAA) via DocuSign.</p>
      <p>Welcome aboard,<br />The HealthGig Team</p>
    `,
  })
}

/**
 * Sent when an admin requests more information or rejects a provider's
 * verification review.
 */
export async function sendVerificationActionEmail(
  provider: ProviderEmailContext,
  action: 'more_info_requested' | 'rejected',
  notes: string
): Promise<SendEmailResponse> {
  const subject =
    action === 'more_info_requested'
      ? 'Action needed: your HealthGig verification'
      : 'Update on your HealthGig verification'

  const intro =
    action === 'more_info_requested'
      ? 'We need a bit more information before we can approve your provider verification.'
      : "We're unable to approve your provider verification at this time."

  return sendEmail({
    to: provider.email,
    subject,
    html: `
      <p>Hi ${provider.firstName},</p>
      <p>${intro}</p>
      <p><strong>Message from our review team:</strong></p>
      <p>${notes}</p>
      ${
        action === 'more_info_requested'
          ? '<p>Please log in and upload the requested information so we can continue the review.</p>'
          : ''
      }
      <p>Thanks,<br />The HealthGig Team</p>
    `,
  })
}
