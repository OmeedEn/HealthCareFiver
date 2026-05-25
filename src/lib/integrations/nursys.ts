/**
 * Nursys (NCSBN) Nurse License Verification Integration
 * Docs: https://www.nursys.com/
 *
 * Nursys is operated by the National Council of State Boards of Nursing
 * (NCSBN) and provides real-time nurse license verification across
 * participating US states and territories.
 *
 * **Important**: Nursys requires an institutional subscription. Contact
 * NCSBN at nursys@ncsbn.org to apply. Access is restricted to approved
 * entities (healthcare employers, staffing agencies, etc.). You must sign
 * a data-use agreement and provide proof of legitimate need.
 *
 * Nursys e-Notify can also push license status changes via webhook.
 */

const DEFAULT_NURSYS_URL = 'https://www.nursys.com/api/v1'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LicenseStatus =
  | 'active'
  | 'inactive'
  | 'expired'
  | 'revoked'
  | 'suspended'
  | 'surrendered'
  | 'probation'
  | 'pending'
  | 'not_found'

export type LicenseType =
  | 'RN'   // Registered Nurse
  | 'LPN'  // Licensed Practical Nurse
  | 'LVN'  // Licensed Vocational Nurse
  | 'APRN' // Advanced Practice Registered Nurse

export interface NursysLicenseRecord {
  licenseNumber: string
  state: string
  status: LicenseStatus
  licenseType: LicenseType | string
  holderFirstName: string
  holderLastName: string
  issueDate: string | null
  expirationDate: string | null
  /** Discipline actions on record, if any */
  disciplines: NursysDiscipline[]
}

export interface NursysDiscipline {
  actionType: string
  actionDate: string
  description: string
  state: string
}

export interface VerifyLicenseRequest {
  licenseNumber: string
  /** Two-letter US state code (e.g., "CA", "TX") */
  state: string
  /** Optional — used for additional matching confidence */
  lastName?: string
}

export interface VerifyLicenseResponse {
  found: boolean
  record: NursysLicenseRecord | null
  /** When Nursys is unavailable, this flag indicates manual review is needed */
  manualReviewRequired: boolean
  message?: string
}

export interface BatchVerifyRequest {
  licenses: VerifyLicenseRequest[]
}

export interface BatchVerifyResponse {
  results: VerifyLicenseResponse[]
  /** Number of licenses that could not be verified automatically */
  manualReviewCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig() {
  return {
    apiKey: process.env.NURSYS_API_KEY || null,
    apiUrl: process.env.NURSYS_API_URL || DEFAULT_NURSYS_URL,
  }
}

function isConfigured(): boolean {
  return !!getConfig().apiKey
}

async function nursysFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getConfig()
  if (!config.apiKey) {
    throw new Error('NURSYS_API_KEY is not configured')
  }

  const response = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Nursys API error (${response.status}): ${body}`)
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Fallback (manual review)
// ---------------------------------------------------------------------------

function manualReviewResponse(
  licenseNumber: string,
  state: string
): VerifyLicenseResponse {
  console.warn(
    `[Nursys] API key not set — license ${licenseNumber} (${state}) requires manual review`
  )
  return {
    found: false,
    record: null,
    manualReviewRequired: true,
    message:
      'Automated license verification is unavailable. ' +
      'This license will be flagged for manual review by an administrator.',
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a single nurse license by license number and state.
 *
 * If the Nursys API key is not configured, returns a manual-review response
 * so the admin workflow can handle it.
 */
export async function verifyLicense(
  request: VerifyLicenseRequest
): Promise<VerifyLicenseResponse> {
  if (!isConfigured()) {
    return manualReviewResponse(request.licenseNumber, request.state)
  }

  try {
    const params = new URLSearchParams({
      license_number: request.licenseNumber,
      state: request.state,
    })
    if (request.lastName) {
      params.set('last_name', request.lastName)
    }

    const result = await nursysFetch<{
      found: boolean
      license?: {
        license_number: string
        state: string
        status: string
        license_type: string
        first_name: string
        last_name: string
        issue_date: string | null
        expiration_date: string | null
        disciplines: Array<{
          action_type: string
          action_date: string
          description: string
          state: string
        }>
      }
    }>(`/licenses/verify?${params.toString()}`)

    if (!result.found || !result.license) {
      return {
        found: false,
        record: null,
        manualReviewRequired: false,
        message: `No license found matching ${request.licenseNumber} in ${request.state}`,
      }
    }

    const lic = result.license
    return {
      found: true,
      record: {
        licenseNumber: lic.license_number,
        state: lic.state,
        status: lic.status as LicenseStatus,
        licenseType: lic.license_type,
        holderFirstName: lic.first_name,
        holderLastName: lic.last_name,
        issueDate: lic.issue_date,
        expirationDate: lic.expiration_date,
        disciplines: lic.disciplines.map((d) => ({
          actionType: d.action_type,
          actionDate: d.action_date,
          description: d.description,
          state: d.state,
        })),
      },
      manualReviewRequired: false,
    }
  } catch (error) {
    console.error('[Nursys] Verification failed, falling back to manual review:', error)
    return {
      found: false,
      record: null,
      manualReviewRequired: true,
      message: `Automated verification failed. Error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Verify multiple nurse licenses in a batch.
 *
 * Each license is verified independently; failures are captured per-license
 * rather than failing the entire batch.
 */
export async function batchVerifyLicenses(
  request: BatchVerifyRequest
): Promise<BatchVerifyResponse> {
  const results = await Promise.all(
    request.licenses.map((lic) => verifyLicense(lic))
  )

  return {
    results,
    manualReviewCount: results.filter((r) => r.manualReviewRequired).length,
  }
}
