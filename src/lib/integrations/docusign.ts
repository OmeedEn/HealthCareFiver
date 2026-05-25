/**
 * DocuSign E-Signature Integration
 * Docs: https://developers.docusign.com/docs/esign-rest-api/
 *
 * Used to send contracts (e.g., contractor agreements, facility service
 * agreements) for electronic signature via embedded or remote signing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnvelopeStatus =
  | 'created'
  | 'sent'
  | 'delivered'
  | 'completed'
  | 'declined'
  | 'voided'

export interface Signer {
  name: string
  email: string
  /** Unique ID used to identify the signer within the envelope (e.g., "1") */
  recipientId: string
  /** Client-side user ID for embedded signing */
  clientUserId?: string
}

export interface CreateEnvelopeRequest {
  /** Subject line of the signing email */
  subject: string
  /** Base64-encoded PDF document to be signed */
  documentBase64: string
  /** Filename displayed in DocuSign */
  documentName: string
  /** List of signers */
  signers: Signer[]
  /** If true, send immediately; otherwise save as draft */
  sendNow?: boolean
}

export interface CreateEnvelopeResponse {
  envelopeId: string
  status: EnvelopeStatus
  uri: string
}

export interface SigningUrlRequest {
  envelopeId: string
  signer: Signer
  /** URL to redirect to after signing is complete */
  returnUrl: string
}

export interface SigningUrlResponse {
  url: string
}

export interface EnvelopeStatusResponse {
  envelopeId: string
  status: EnvelopeStatus
  completedAt: string | null
  sentAt: string | null
}

/** Webhook event types emitted by DocuSign Connect */
export type DocuSignWebhookEvent =
  | 'envelope-sent'
  | 'envelope-delivered'
  | 'envelope-completed'
  | 'envelope-declined'
  | 'envelope-voided'
  | 'recipient-sent'
  | 'recipient-delivered'
  | 'recipient-completed'
  | 'recipient-declined'

export interface DocuSignWebhookPayload {
  event: DocuSignWebhookEvent
  apiVersion: string
  uri: string
  retryCount: number
  configurationId: string
  generatedDateTime: string
  data: {
    accountId: string
    envelopeId: string
    envelopeSummary: {
      status: EnvelopeStatus
      completedDateTime?: string
      sentDateTime?: string
    }
  }
}

export interface ContractData {
  contractorName: string
  facilityName: string
  shiftDescription: string
  hourlyRate: number
  startDate: string
  endDate?: string
  terms: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig() {
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || null,
    secretKey: process.env.DOCUSIGN_SECRET_KEY || '',
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || '',
    baseUrl: process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi',
  }
}

function isConfigured(): boolean {
  return !!getConfig().integrationKey
}

async function docusignFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getConfig()
  if (!config.integrationKey) {
    throw new Error('DOCUSIGN_INTEGRATION_KEY is not configured')
  }

  const url = `${config.baseUrl}/v2.1/accounts/${config.accountId}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.integrationKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`DocuSign API error (${response.status}): ${body}`)
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Mock responses
// ---------------------------------------------------------------------------

function mockCreateEnvelope(): CreateEnvelopeResponse {
  console.warn('[DocuSign] Integration key not set — returning mock response')
  return {
    envelopeId: `mock_env_${Date.now()}`,
    status: 'sent',
    uri: '/envelopes/mock',
  }
}

function mockGetSigningUrl(): SigningUrlResponse {
  console.warn('[DocuSign] Integration key not set — returning mock response')
  return { url: 'https://example.com/mock-signing' }
}

function mockGetEnvelopeStatus(envelopeId: string): EnvelopeStatusResponse {
  console.warn('[DocuSign] Integration key not set — returning mock response')
  return {
    envelopeId,
    status: 'completed',
    completedAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Contract PDF generation helper
// ---------------------------------------------------------------------------

/**
 * Generate a simple plain-text contract document and return it as a
 * base64-encoded string suitable for the `documentBase64` field.
 *
 * In production, replace this with a proper PDF library (e.g., pdf-lib or
 * Puppeteer HTML-to-PDF) for branded contract generation.
 */
export function generateContractBase64(data: ContractData): string {
  const text = [
    'INDEPENDENT CONTRACTOR AGREEMENT',
    '================================',
    '',
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Contractor: ${data.contractorName}`,
    `Facility:   ${data.facilityName}`,
    '',
    'Shift Details',
    '-------------',
    `Description: ${data.shiftDescription}`,
    `Hourly Rate: $${data.hourlyRate.toFixed(2)}`,
    `Start Date:  ${data.startDate}`,
    data.endDate ? `End Date:    ${data.endDate}` : '',
    '',
    'Terms & Conditions',
    '------------------',
    data.terms,
    '',
    '',
    'Signature: ___________________________    Date: __________',
    '',
  ]
    .filter(Boolean)
    .join('\n')

  return Buffer.from(text).toString('base64')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an envelope (document package) for signing.
 */
export async function createEnvelope(
  request: CreateEnvelopeRequest
): Promise<CreateEnvelopeResponse> {
  if (!isConfigured()) {
    return mockCreateEnvelope()
  }

  const body = {
    emailSubject: request.subject,
    documents: [
      {
        documentBase64: request.documentBase64,
        name: request.documentName,
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: {
      signers: request.signers.map((s) => ({
        email: s.email,
        name: s.name,
        recipientId: s.recipientId,
        clientUserId: s.clientUserId,
        tabs: {
          signHereTabs: [
            {
              anchorString: 'Signature:',
              anchorUnits: 'pixels',
              anchorXOffset: '150',
              anchorYOffset: '-10',
            },
          ],
          dateSignedTabs: [
            {
              anchorString: 'Date:',
              anchorUnits: 'pixels',
              anchorXOffset: '80',
              anchorYOffset: '-10',
            },
          ],
        },
      })),
    },
    status: request.sendNow ? 'sent' : 'created',
  }

  const result = await docusignFetch<{
    envelopeId: string
    status: string
    uri: string
  }>('/envelopes', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return {
    envelopeId: result.envelopeId,
    status: result.status as EnvelopeStatus,
    uri: result.uri,
  }
}

/**
 * Generate an embedded signing URL for a recipient.
 * The user is redirected to this URL to sign within your application.
 */
export async function createSigningUrl(
  request: SigningUrlRequest
): Promise<SigningUrlResponse> {
  if (!isConfigured()) {
    return mockGetSigningUrl()
  }

  const result = await docusignFetch<{ url: string }>(
    `/envelopes/${request.envelopeId}/views/recipient`,
    {
      method: 'POST',
      body: JSON.stringify({
        returnUrl: request.returnUrl,
        authenticationMethod: 'none',
        email: request.signer.email,
        userName: request.signer.name,
        clientUserId: request.signer.clientUserId,
        recipientId: request.signer.recipientId,
      }),
    }
  )

  return { url: result.url }
}

/**
 * Retrieve the current status of an envelope.
 */
export async function getEnvelopeStatus(
  envelopeId: string
): Promise<EnvelopeStatusResponse> {
  if (!isConfigured()) {
    return mockGetEnvelopeStatus(envelopeId)
  }

  const result = await docusignFetch<{
    envelopeId: string
    status: string
    completedDateTime?: string
    sentDateTime?: string
  }>(`/envelopes/${envelopeId}`)

  return {
    envelopeId: result.envelopeId,
    status: result.status as EnvelopeStatus,
    completedAt: result.completedDateTime || null,
    sentAt: result.sentDateTime || null,
  }
}
