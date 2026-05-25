/**
 * Persona Identity Verification Integration
 * Docs: https://docs.withpersona.com/reference
 *
 * Persona provides identity verification (ID checks, selfie matching, etc.)
 * used during contractor onboarding to verify real identity.
 */

const PERSONA_API_URL = 'https://withpersona.com/api/v1'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InquiryStatus =
  | 'created'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'approved'
  | 'declined'
  | 'needs_review'

export interface PersonaInquiry {
  id: string
  type: 'inquiry'
  attributes: {
    status: InquiryStatus
    reference_id: string | null
    note: string | null
    created_at: string
    completed_at: string | null
    expired_at: string | null
  }
}

export interface CreateInquiryRequest {
  /** Your internal user/contractor ID — stored as reference_id in Persona */
  referenceId: string
  /** First name of the person being verified */
  firstName?: string
  /** Last name of the person being verified */
  lastName?: string
  /** Email address — used for Persona-hosted flow notifications */
  email?: string
}

export interface CreateInquiryResponse {
  inquiryId: string
  status: InquiryStatus
  /** URL to redirect the user to for completing verification (hosted flow) */
  sessionToken?: string
}

export interface InquiryStatusResponse {
  inquiryId: string
  status: InquiryStatus
  completedAt: string | null
}

/** Webhook event types emitted by Persona */
export type PersonaWebhookEvent =
  | 'inquiry.created'
  | 'inquiry.completed'
  | 'inquiry.failed'
  | 'inquiry.expired'
  | 'inquiry.approved'
  | 'inquiry.declined'
  | 'inquiry.transitioned'

export interface PersonaWebhookPayload {
  data: {
    type: 'event'
    id: string
    attributes: {
      name: PersonaWebhookEvent
      payload: {
        data: PersonaInquiry
      }
      created_at: string
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string | null {
  return process.env.PERSONA_API_KEY || null
}

function getTemplateId(): string {
  return process.env.PERSONA_TEMPLATE_ID || ''
}

async function personaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('PERSONA_API_KEY is not configured')
  }

  const response = await fetch(`${PERSONA_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Persona-Version': '2023-01-05',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Persona API error (${response.status}): ${body}`)
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Mock responses (used when API key is not configured)
// ---------------------------------------------------------------------------

function mockCreateInquiry(req: CreateInquiryRequest): CreateInquiryResponse {
  console.warn('[Persona] API key not set — returning mock verified response')
  return {
    inquiryId: `mock_inq_${req.referenceId}`,
    status: 'approved',
    sessionToken: undefined,
  }
}

function mockGetInquiryStatus(inquiryId: string): InquiryStatusResponse {
  console.warn('[Persona] API key not set — returning mock verified response')
  return {
    inquiryId,
    status: 'approved',
    completedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new identity verification inquiry.
 * The returned session token can be used to embed Persona's hosted flow.
 */
export async function createInquiry(
  request: CreateInquiryRequest
): Promise<CreateInquiryResponse> {
  if (!getApiKey()) {
    return mockCreateInquiry(request)
  }

  const result = await personaFetch<{ data: PersonaInquiry; meta: { session_token?: string } }>(
    '/inquiries',
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          attributes: {
            'inquiry-template-id': getTemplateId(),
            'reference-id': request.referenceId,
            fields: {
              'name-first': { type: 'string', value: request.firstName },
              'name-last': { type: 'string', value: request.lastName },
              'email-address': { type: 'string', value: request.email },
            },
          },
        },
      }),
    }
  )

  return {
    inquiryId: result.data.id,
    status: result.data.attributes.status,
    sessionToken: result.meta?.session_token,
  }
}

/**
 * Retrieve the current status of an identity verification inquiry.
 */
export async function getInquiryStatus(
  inquiryId: string
): Promise<InquiryStatusResponse> {
  if (!getApiKey()) {
    return mockGetInquiryStatus(inquiryId)
  }

  const result = await personaFetch<{ data: PersonaInquiry }>(
    `/inquiries/${inquiryId}`
  )

  return {
    inquiryId: result.data.id,
    status: result.data.attributes.status,
    completedAt: result.data.attributes.completed_at,
  }
}
