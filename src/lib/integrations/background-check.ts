// Checkr API integration for background checks
// Docs: https://docs.checkr.com

const CHECKR_API_URL = 'https://api.checkr.com/v1'

interface CheckrCandidate {
  id: string
  first_name: string
  last_name: string
  email: string
  dob: string
  ssn: string
  driver_license_number?: string
  driver_license_state?: string
}

interface CheckrInvitation {
  id: string
  status: string
  uri: string
  candidate_id: string
  package: string
}

interface CheckrReport {
  id: string
  status: string
  result: string | null
  candidate_id: string
  package: string
  completed_at: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isConfigured(): boolean {
  return !!process.env.CHECKR_API_KEY
}

function authHeader(): string {
  return `Basic ${Buffer.from(process.env.CHECKR_API_KEY + ':').toString('base64')}`
}

// ---------------------------------------------------------------------------
// Mock responses (used when API key is not configured)
// ---------------------------------------------------------------------------

function mockCreateCandidate(candidate: { first_name: string; last_name: string; email: string }): CheckrCandidate {
  console.warn('[Checkr] API key not set — returning mock manual-review response')
  return {
    id: `mock_cand_${candidate.email}`,
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    email: candidate.email,
    dob: '',
    ssn: '',
  }
}

function mockCreateInvitation(candidateId: string, packageSlug: string): CheckrInvitation {
  console.warn('[Checkr] API key not set — returning mock manual-review response')
  return {
    id: `mock_inv_${candidateId}`,
    status: 'pending',
    uri: '/invitations/mock',
    candidate_id: candidateId,
    package: packageSlug,
  }
}

function mockGetReport(reportId: string): CheckrReport {
  console.warn('[Checkr] API key not set — returning mock manual-review response')
  return {
    id: reportId,
    status: 'pending',
    result: null,
    candidate_id: '',
    package: '',
    completed_at: null,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createCandidate(candidate: {
  first_name: string
  last_name: string
  email: string
  dob: string
  ssn: string
}): Promise<CheckrCandidate> {
  if (!isConfigured()) {
    return mockCreateCandidate(candidate)
  }

  const response = await fetch(`${CHECKR_API_URL}/candidates`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(candidate),
  })

  if (!response.ok) {
    throw new Error(`Checkr API error: ${response.statusText}`)
  }

  return response.json()
}

export async function createInvitation(
  candidateId: string,
  packageSlug: string = 'healthcare_basic'
): Promise<CheckrInvitation> {
  if (!isConfigured()) {
    return mockCreateInvitation(candidateId, packageSlug)
  }

  const response = await fetch(`${CHECKR_API_URL}/invitations`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      candidate_id: candidateId,
      package: packageSlug,
    }),
  })

  if (!response.ok) {
    throw new Error(`Checkr API error: ${response.statusText}`)
  }

  return response.json()
}

export async function getReport(reportId: string): Promise<CheckrReport> {
  if (!isConfigured()) {
    return mockGetReport(reportId)
  }

  const response = await fetch(`${CHECKR_API_URL}/reports/${reportId}`, {
    headers: {
      Authorization: authHeader(),
    },
  })

  if (!response.ok) {
    throw new Error(`Checkr API error: ${response.statusText}`)
  }

  return response.json()
}
