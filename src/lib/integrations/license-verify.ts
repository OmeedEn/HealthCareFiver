// State license verification
// This is a stub — real implementation requires per-state API integrations
// Some states offer APIs, others require manual verification

interface LicenseVerificationResult {
  valid: boolean
  status: 'active' | 'inactive' | 'expired' | 'revoked' | 'not_found'
  holder_name?: string
  license_number?: string
  license_type?: string
  state?: string
  issue_date?: string
  expiration_date?: string
  error?: string
}

// Manual verification — admin reviews uploaded documents
// This function is a placeholder for future API-based verification
export async function verifyStateLicense(
  licenseNumber: string,
  state: string,
  _licenseType: string
): Promise<LicenseVerificationResult> {
  // States with known APIs:
  // - California: https://www.breeze.ca.gov/
  // - New York: https://www.op.nysed.gov/verification-search
  // - Texas: https://www.bon.texas.gov/
  // - Florida: https://mqa-internet.doh.state.fl.us/MQASearchServices/

  // For MVP, return a "manual review required" result
  // The admin will review credential documents manually
  console.log(
    `License verification requested: ${licenseNumber} in ${state}`
  )

  return {
    valid: false,
    status: 'not_found',
    error: `Automated verification not yet available for ${state}. Document will be reviewed manually by admin.`,
  }
}

// States that support automated verification (future)
export const STATES_WITH_API = [
  'CA', // California — Breeze system
  'NY', // New York — NYSED
  'TX', // Texas — BON
  'FL', // Florida — MQA
] as const
