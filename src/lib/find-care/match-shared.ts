// Client results screen ("Here are professionals who may be a good fit"):
// constants and the shape that crosses to the browser. Pure — safe on
// server and client. The matcher itself is src/lib/find-care/match.ts.

import type { PublicProvider } from './types'

export const CLIENT_MATCHES_PATH = '/dashboard/matches'

/** Most professionals shown on the results screen. */
export const MAX_MATCHES = 6
/** Fewer than this → the fallback message and "Request help finding someone". */
export const MIN_MATCHES = 3

/**
 * A matched professional: the public browse shape plus why they matched.
 * Same rule as PublicProvider: never contact info, ZIP, or license numbers.
 */
export type MatchedProvider = PublicProvider & {
  /** Interest keys (CLIENT_INTERESTS) this professional matched. */
  matched_interests: string[]
  /** Formats from their published listings: virtual | in_person | home_visit. */
  formats: string[]
  /** Same state as the client's ZIP. */
  same_state: boolean
}

export const FORMAT_LABELS: Record<string, string> = {
  virtual: 'Virtual',
  in_person: 'In person',
  home_visit: 'Home visit',
}
