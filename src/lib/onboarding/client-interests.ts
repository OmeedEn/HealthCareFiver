// What a client (consumer) is looking for: the 11 tiles on /signup/client
// ("What kind of help are you looking for?"). Shared by the signup flow, the
// /api/auth/signup validator, the Google signup cookie, settings, the client
// dashboard and the matcher (src/lib/find-care/match.ts), so the stored keys
// and their labels never drift apart.
export const CLIENT_INTERESTS = [
  { key: 'clinical', label: 'Clinical care', sub: 'Doctors, nurses, NPs, telehealth' },
  { key: 'mental_health', label: 'Mental health & counseling', sub: 'Therapists, psychologists, counselors' },
  { key: 'nutrition', label: 'Nutrition & dietetics', sub: 'Dietitians, nutritionists, meal planning' },
  { key: 'coaching', label: 'Health coaching & wellness', sub: 'Behavior change, lifestyle' },
  { key: 'physical_therapy', label: 'Physical therapy & rehab', sub: 'PT, OT, injury recovery' },
  { key: 'fitness', label: 'Personal training & fitness', sub: 'Trainers, strength, conditioning' },
  { key: 'bodywork', label: 'Bodywork & massage', sub: 'Massage, acupuncture, stretching' },
  { key: 'birth_family', label: 'Birth & family support', sub: 'Doulas, lactation, postpartum' },
  { key: 'advice_advocacy', label: 'Advice & advocacy', sub: 'Patient advocates, billing, legal help' },
  { key: 'events_education', label: 'Events & education', sub: 'Classes, workshops, support groups' },
  { key: 'not_sure', label: 'Not sure yet', sub: 'We’ll help you figure it out' },
] as const

export type ClientInterestKey = (typeof CLIENT_INTERESTS)[number]['key']

export const CLIENT_INTEREST_KEYS = CLIENT_INTERESTS.map((i) => i.key) as [
  ClientInterestKey,
  ...ClientInterestKey[],
]

/**
 * Keys from the earlier 9-tile list (migration
 * 20261016000400_client_single_question.sql rewrites stored rows). Still
 * accepted from a stale signup tab or Google cookie and mapped forward.
 */
export const LEGACY_CLIENT_INTERESTS: Record<string, ClientInterestKey> = {
  consulting: 'advice_advocacy',
  education: 'events_education',
  other: 'not_sure',
}

const KEY_SET = new Set<string>(CLIENT_INTEREST_KEYS)

/** Current key for a stored or submitted key, or null when it isn't one. */
export function normalizeClientInterest(key: string): ClientInterestKey | null {
  if (KEY_SET.has(key)) return key as ClientInterestKey
  return LEGACY_CLIENT_INTERESTS[key] ?? null
}

/** Maps legacy keys forward, drops unknown ones, de-duplicates (order kept). */
export function normalizeClientInterests(keys: readonly string[]): ClientInterestKey[] {
  const out: ClientInterestKey[] = []
  for (const k of keys) {
    const n = normalizeClientInterest(k)
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

export const CLIENT_INTEREST_LABELS: Record<string, string> = Object.fromEntries([
  ...CLIENT_INTERESTS.map((i) => [i.key, i.label]),
  // Rows not yet migrated still read sensibly.
  ...Object.entries(LEGACY_CLIENT_INTERESTS).map(([legacy, key]) => [
    legacy,
    CLIENT_INTERESTS.find((i) => i.key === key)!.label,
  ]),
])

/* ───────── Other client answers (client_profiles columns) ───────── */

export const HELP_TIMELINES = [
  { value: 'asap', label: 'As soon as possible', sub: 'Within the next few days' },
  { value: 'two_weeks', label: 'Within 2 weeks' },
  { value: 'month', label: 'Within a month' },
  { value: 'exploring', label: 'Just exploring' },
] as const
export type HelpTimeline = (typeof HELP_TIMELINES)[number]['value']
export const HELP_TIMELINE_VALUES = HELP_TIMELINES.map((t) => t.value) as [HelpTimeline, ...HelpTimeline[]]

export const MEETING_FORMATS = [
  { value: 'virtual', label: 'Virtual' },
  { value: 'in_person', label: 'In person' },
  { value: 'home_visit', label: 'Home visit' },
  { value: 'no_preference', label: 'No preference' },
] as const
export type MeetingFormat = (typeof MEETING_FORMATS)[number]['value']
export const MEETING_FORMAT_VALUES = MEETING_FORMATS.map((f) => f.value) as [MeetingFormat, ...MeetingFormat[]]

/** The ZIP screen shows only when they picked a format that needs a location. */
export function needsZip(formats: readonly string[]): boolean {
  return formats.includes('in_person') || formats.includes('home_visit')
}

/** Budget per session (dashboard "Improve your matches" item). */
export const CLIENT_BUDGETS = [
  { value: 'under_50', label: 'Under $50' },
  { value: '50_100', label: '$50–$100' },
  { value: '100_200', label: '$100–$200' },
  { value: 'over_200', label: 'Over $200' },
  { value: 'flexible', label: 'Flexible' },
] as const
export type ClientBudget = (typeof CLIENT_BUDGETS)[number]['value']
export const CLIENT_BUDGET_VALUES = CLIENT_BUDGETS.map((b) => b.value) as [ClientBudget, ...ClientBudget[]]

/** Max lengths, mirrored by CHECK constraints in the migration. */
export const CLIENT_NOTE_MAX = 200
export const CLIENT_GOALS_MAX = 300
export const CLIENT_LANGUAGE_MAX = 60
