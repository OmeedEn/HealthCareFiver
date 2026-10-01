interface NPIResult {
  result_count: number
  results: Array<{
    number: string
    basic: {
      first_name: string
      last_name: string
      credential: string
      sole_proprietor: string
      gender: string
      enumeration_date: string
      last_updated: string
      status: string
      name_prefix: string
    }
    taxonomies: Array<{
      code: string
      taxonomy_group: string
      desc: string
      state: string
      license: string
      primary: boolean
    }>
    addresses: Array<{
      country_code: string
      country_name: string
      address_purpose: string
      address_type: string
      address_1: string
      city: string
      state: string
      postal_code: string
      telephone_number: string
    }>
  }>
}

/**
 * Offline NPI format check: exactly 10 digits whose last digit is the Luhn
 * check digit computed over the prefix "80840" + the first 9 digits (CMS
 * NPI check-digit algorithm). Pure — safe in client components.
 */
export function isValidNpiFormat(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false
  // The "80840" prefix contributes a constant 24 to the Luhn sum.
  let sum = 24
  for (let i = 0; i < 9; i++) {
    let d = Number(npi[8 - i])
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (10 - (sum % 10)) % 10 === Number(npi[9])
}

export async function lookupNPI(npiNumber: string): Promise<{
  valid: boolean
  data?: NPIResult['results'][0]
  error?: string
}> {
  try {
    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?number=${npiNumber}&version=2.1`
    )

    if (!response.ok) {
      return { valid: false, error: 'Failed to reach NPI registry' }
    }

    const data: NPIResult = await response.json()

    if (data.result_count === 0) {
      return { valid: false, error: 'NPI number not found' }
    }

    return { valid: true, data: data.results[0] }
  } catch {
    return { valid: false, error: 'Error connecting to NPI registry' }
  }
}

export async function searchNPIByName(
  firstName: string,
  lastName: string,
  state?: string
): Promise<NPIResult['results']> {
  const params = new URLSearchParams({
    first_name: firstName,
    last_name: lastName,
    version: '2.1',
    limit: '10',
  })
  if (state) params.set('state', state)

  try {
    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`
    )
    if (!response.ok) return []
    const data: NPIResult = await response.json()
    return data.results || []
  } catch {
    return []
  }
}
