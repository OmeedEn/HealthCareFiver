/**
 * profiles has no name columns — names live in the role tables, which are
 * 1:1 with profiles (same id). Embed this under a profiles relation, then read
 * it with profileName().
 */
export const PROFILE_NAME_SELECT =
  // contractor_profiles has two FKs to profiles (id, verification_reviewed_by),
// so the embed must name the id FK.
  'id, avatar_url, role, contractor_profiles!contractor_profiles_id_fkey(first_name, last_name), facility_profiles(facility_name), client_profiles(first_name, last_name)'

type Named = { first_name: string | null; last_name: string | null }

export interface ProfileWithNames {
  id: string
  avatar_url?: string | null
  role?: string | null
  contractor_profiles?: Named | Named[] | null
  facility_profiles?: { facility_name: string | null } | { facility_name: string | null }[] | null
  client_profiles?: Named | Named[] | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

export function profileName(p: ProfileWithNames | null | undefined): {
  first_name: string
  last_name: string
} {
  if (!p) return { first_name: 'Unknown', last_name: '' }
  const person = one(p.contractor_profiles) ?? one(p.client_profiles)
  if (person?.first_name) {
    return { first_name: person.first_name, last_name: person.last_name ?? '' }
  }
  const facility = one(p.facility_profiles)
  if (facility?.facility_name) return { first_name: facility.facility_name, last_name: '' }
  return { first_name: 'Unknown', last_name: '' }
}
