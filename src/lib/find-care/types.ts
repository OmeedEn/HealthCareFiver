/**
 * Public, browse-safe shape of a professional shown on /find-care.
 *
 * This is the ONLY data that crosses to the client for public browsing.
 * Never add contact info (email, phone), license / NPI numbers, zip codes,
 * verification documents, or Stripe identifiers here.
 */
export type ProfessionalCategory =
  | 'clinical'
  | 'allied'
  | 'consultant'
  | 'educator'

export type PublicProvider = {
  id: string
  first_name: string
  last_name: string
  /** Short credential badge, e.g. "RN", "PT". */
  credential: string
  contractor_type: string
  professional_category: ProfessionalCategory | null
  /** Primary specialty line under the name. */
  specialty: string
  specialties: string[]
  headline: string
  bio: string | null
  avatar_url: string | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  city: string | null
  state: string | null
  average_rating: number
  total_reviews: number
  is_available: boolean
  /** Empty when unknown (real profiles don't record session formats yet). */
  session_types: string[]
  /** Admin reviewed a current malpractice certificate (insured_verified_at). */
  insured: boolean
}

export const PROFESSIONAL_CATEGORY_LABELS: Record<ProfessionalCategory, string> =
  {
    clinical: 'Licensed clinical professional',
    allied: 'Allied & certified practitioner',
    consultant: 'Healthcare consultant',
    educator: 'Educator & trainer',
  }

/** contractor_type enum (20250523000001_create_enums.sql) -> short badge. */
export const CONTRACTOR_TYPE_BADGES: Record<string, string> = {
  rn: 'RN',
  lpn: 'LPN',
  cna: 'CNA',
  np: 'NP',
  pa: 'PA',
  md: 'MD',
  do: 'DO',
  pt: 'PT',
  ot: 'OT',
  slp: 'SLP',
  rt: 'RT',
  pharm: 'PharmD',
  rad_tech: 'Rad Tech',
  lab_tech: 'Lab Tech',
  ma: 'MA',
  emt: 'EMT',
  sw: 'SW',
}
