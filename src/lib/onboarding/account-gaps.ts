import type { User } from '@supabase/supabase-js'

/**
 * What /onboarding/account still needs to collect for this user. Phone is
 * no longer asked at signup (Single-Question Onboarding): it's a "Make your
 * profile stand out" item on the dashboard.
 */
export interface AccountGaps {
  name: boolean
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
  contractor: { first_name: string | null; last_name: string | null } | null
): AccountGaps {
  return {
    name: !str(contractor?.first_name) || !str(contractor?.last_name),
    terms: missingTerms(user),
  }
}

export function hasGaps(g: AccountGaps): boolean {
  return g.name || g.terms
}

/**
 * Cheap check the proxy can run with the session user alone: is Terms
 * consent missing? Accepting any version counts; the version is recorded so
 * a future re-consent flow can compare against TERMS_VERSION (src/lib/legal.ts).
 * Names need an extra query, so /onboarding/account itself handles those.
 */
export function missingTerms(user: User): boolean {
  const meta = (user.user_metadata ?? {}) as Meta
  return !str(meta.terms_accepted_at) || !str(meta.terms_version)
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
