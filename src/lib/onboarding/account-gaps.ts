import type { User } from '@supabase/supabase-js'
import { normalizeUsPhone } from '@/lib/phone'

/** What /onboarding/account still needs to collect for this user. */
export interface AccountGaps {
  name: boolean
  phone: boolean
  terms: boolean
}

export interface AccountPrefill {
  firstName: string
  lastName: string
}

type Meta = Record<string, unknown>

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function computeGaps(
  user: User,
  profilePhone: string | null | undefined,
  contractor: { first_name: string | null; last_name: string | null } | null
): AccountGaps {
  const meta = (user.user_metadata ?? {}) as Meta
  return {
    name: !str(contractor?.first_name) || !str(contractor?.last_name),
    phone: normalizeUsPhone(profilePhone) === null,
    // Accepting any version counts; the version is recorded so a future
    // re-consent flow can compare against TERMS_VERSION (src/lib/legal.ts).
    terms: !str(meta.terms_accepted_at) || !str(meta.terms_version),
  }
}

export function hasGaps(g: AccountGaps): boolean {
  return g.name || g.phone || g.terms
}

/**
 * Cheap check the proxy can run with data it already has (session user +
 * profiles.phone): is terms consent or phone missing? Names need an extra
 * query, so /onboarding/account itself handles those.
 */
export function missingPhoneOrTerms(
  user: User,
  profilePhone: string | null | undefined
): boolean {
  const g = computeGaps(user, profilePhone, { first_name: 'x', last_name: 'x' })
  return g.phone || g.terms
}

/** Best-effort name prefill from what Google (or signup) put in metadata. */
export function namePrefill(
  user: User,
  contractor: { first_name: string | null; last_name: string | null } | null
): AccountPrefill {
  const meta = (user.user_metadata ?? {}) as Meta
  const full = str(meta.full_name) || str(meta.name)
  const [fullFirst, ...rest] = full.split(/\s+/).filter(Boolean)
  return {
    firstName:
      str(contractor?.first_name) ||
      str(meta.first_name) ||
      str(meta.given_name) ||
      fullFirst ||
      '',
    lastName:
      str(contractor?.last_name) ||
      str(meta.last_name) ||
      str(meta.family_name) ||
      rest.join(' ') ||
      '',
  }
}
