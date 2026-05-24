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

export async function createCandidate(candidate: {
  first_name: string
  last_name: string
  email: string
  dob: string
  ssn: string
}): Promise<CheckrCandidate> {
  const response = await fetch(`${CHECKR_API_URL}/candidates`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(process.env.CHECKR_API_KEY + ':').toString('base64')}`,
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
  const response = await fetch(`${CHECKR_API_URL}/invitations`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(process.env.CHECKR_API_KEY + ':').toString('base64')}`,
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

export async function getReport(reportId: string) {
  const response = await fetch(`${CHECKR_API_URL}/reports/${reportId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(process.env.CHECKR_API_KEY + ':').toString('base64')}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Checkr API error: ${response.statusText}`)
  }

  return response.json()
}
