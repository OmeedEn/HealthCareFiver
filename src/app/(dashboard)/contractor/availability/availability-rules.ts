// Pure helpers for the availability editor: timezone handling and overlap
// checks for weekly windows. No I/O.

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const DAY = 24 * 60
const WEEK = 7 * DAY

/** A weekly window as wall-clock HH:MM times. end <= start means it runs past midnight. */
export interface WeeklyWindow {
  id?: string
  day: number
  start: string
  end: string
}

const toMinutes = (t: string) => {
  const [h, m] = t.slice(0, 5).split(':').map((n) => parseInt(n, 10))
  return (h || 0) * 60 + (m || 0)
}

export const isOvernight = (start: string, end: string) => toMinutes(end) <= toMinutes(start)

/** Minutes from Sunday 00:00, [start, end). Overnight windows spill into the next day. */
function span(w: WeeklyWindow): [number, number] {
  const s = w.day * DAY + toMinutes(w.start)
  let e = w.day * DAY + toMinutes(w.end)
  if (e <= s) e += DAY
  return [s, e]
}

export function windowsOverlap(a: WeeklyWindow, b: WeeklyWindow): boolean {
  const [as, ae] = span(a)
  const [bs, be] = span(b)
  // Shift by a week either way so Saturday-night windows wrap into Sunday.
  return [-WEEK, 0, WEEK].some((shift) => as < be + shift && bs + shift < ae)
}

/**
 * Proposed windows that overlap an existing window or each other.
 * Touching edges (one ends 12:00, the next starts 12:00) is fine.
 */
export function findOverlaps(proposed: WeeklyWindow[], existing: WeeklyWindow[]): WeeklyWindow[] {
  return proposed.filter(
    (p, i) =>
      existing.some((e) => windowsOverlap(p, e)) ||
      proposed.some((q, j) => j !== i && windowsOverlap(p, q))
  )
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function browserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz && isValidTimeZone(tz) ? tz : 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

const FALLBACK_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Puerto_Rico',
  'UTC',
]

/** US zones first, then every other IANA zone; always includes `current`. */
export function timeZoneOptions(current: string): string[] {
  let all: string[] = []
  try {
    all = Intl.supportedValuesOf('timeZone')
  } catch {
    all = []
  }
  const rest = all.filter((z) => !FALLBACK_ZONES.includes(z))
  const list = [...FALLBACK_ZONES, ...rest]
  return list.includes(current) ? list : [current, ...list]
}

/** Today's date (YYYY-MM-DD) in a timezone. */
export function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}
