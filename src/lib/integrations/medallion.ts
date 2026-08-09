/**
 * Medallion Provider Verification Integration
 * Docs: https://developers.medallion.co
 *
 * Medallion performs primary-source verification of clinician licenses,
 * sanctions/exclusions screening, and ongoing monitoring. Used by the
 * admin verification queue to confirm a provider's credentials are
 * legitimate before they go live on the platform.
 */

const MEDALLION_API_URL = 'https://api.medallion.co/v1'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MedallionVerificationStatus =
  | 'created'
  | 'in_progress'
  | 'verified'
  | 'flagged'
  | 'failed'
  | 'needs_review'

export interface CreateVerificationRequest {
  /** Your internal contractor ID — stored as external_id in Medallion */
  externalId: string
  firstName: string
  lastName: string
  email?: string
  npiNumber?: string | null
  licenseNumber?: string | null
  licenseState?: string | null
}

export interface CreateVerificationResponse {
  verificationId: string
  status: MedallionVerificationStatus
}

export interface VerificationResult {
  verificationId: string
  status: MedallionVerificationStatus
  licenseValid: boolean | null
  sanctionsClear: boolean | null
  exclusionsClear: boolean | null
  checkedAt: string | null
  notes: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string | null {
  return process.env.MEDALLION_API_KEY || null
}

async function medallionFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('MEDALLION_API_KEY is not configured')
  }

  const response = await fetch(`${MEDALLION_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Medallion API error (${response.status}): ${body}`)
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Mock responses (used when API key is not configured)
// ---------------------------------------------------------------------------

function mockCreateVerification(
  req: CreateVerificationRequest
): CreateVerificationResponse {
  console.warn('[Medallion] API key not set — returning mock manual-review response')
  return {
    verificationId: `mock_med_${req.externalId}`,
    status: 'needs_review',
  }
}

function mockGetVerificationResult(verificationId: string): VerificationResult {
  console.warn('[Medallion] API key not set — returning mock manual-review response')
  return {
    verificationId,
    status: 'needs_review',
    licenseValid: null,
    sanctionsClear: null,
    exclusionsClear: null,
    checkedAt: null,
    notes: 'Medallion is not configured — requires manual review by an admin.',
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a new primary-source verification for a provider.
 */
export async function createVerification(
  request: CreateVerificationRequest
): Promise<CreateVerificationResponse> {
  if (!getApiKey()) {
    return mockCreateVerification(request)
  }

  const result = await medallionFetch<{ id: string; status: MedallionVerificationStatus }>(
    '/verifications',
    {
      method: 'POST',
      body: JSON.stringify({
        external_id: request.externalId,
        first_name: request.firstName,
        last_name: request.lastName,
        email: request.email,
        npi_number: request.npiNumber,
        license_number: request.licenseNumber,
        license_state: request.licenseState,
      }),
    }
  )

  return { verificationId: result.id, status: result.status }
}

/**
 * Retrieve the current result of a provider verification.
 */
export async function getVerificationStatus(
  verificationId: string
): Promise<VerificationResult> {
  if (!getApiKey()) {
    return mockGetVerificationResult(verificationId)
  }

  const result = await medallionFetch<{
    id: string
    status: MedallionVerificationStatus
    license_valid: boolean | null
    sanctions_clear: boolean | null
    exclusions_clear: boolean | null
    checked_at: string | null
    notes: string | null
  }>(`/verifications/${verificationId}`)

  return {
    verificationId: result.id,
    status: result.status,
    licenseValid: result.license_valid,
    sanctionsClear: result.sanctions_clear,
    exclusionsClear: result.exclusions_clear,
    checkedAt: result.checked_at,
    notes: result.notes,
  }
}
