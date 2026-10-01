/**
 * Provider compliance lifecycle constants + pure date helpers.
 *
 * The helpers are deliberately dependency-free (no Supabase, no Next) so the
 * date math can be unit-tested in isolation.
 */

/** Days after approval a provider who needs malpractice has to upload it. */
export const MALPRACTICE_GRACE_DAYS = 30

/** Days-left thresholds for malpractice grace reminders. */
export const GRACE_REMINDER_DAYS = [14, 7, 1] as const

/** Days-before-expiry thresholds for license / malpractice / ID reminders. */
export const EXPIRY_REMINDER_DAYS = [60, 30] as const

/** Re-run OIG / SAM / Medi-Cal exclusion screening at least this often. */
export const EXCLUSION_RESCREEN_DAYS = 30

/** Verification statuses whose providers are (or can be) live. */
export const LIVE_VERIFICATION_STATUSES = ['approved', 'insurance_pending'] as const

/** Credential types whose lapse puts the provider on a compliance hold. */
export const HOLD_CREDENTIAL_TYPES = ['license', 'certification', 'government_id'] as const

/**
 * Credential types whose lapse the cron acts on (hold, or malpractice
 * pause). Expiry *reminders* go out for every verified credential type.
 */
export const LAPSE_CREDENTIAL_TYPES = [...HOLD_CREDENTIAL_TYPES, 'malpractice_insurance'] as const

/** Weekday (UTC, 0 = Sunday) the exclusion re-screen digest goes out. */
export const EXCLUSION_DIGEST_WEEKDAY = 1

/**
 * Prefixes for contractor_profiles.compliance_hold_reason written by the
 * cron. Holds the cron sets always start with one of these, so code (and
 * admins) can tell an automated lapse hold from a manual one.
 */
export const HOLD_REASON_PREFIX = {
  license: 'License expired on ',
  certification: 'Certification expired on ',
  government_id: 'Government ID expired on ',
} as const

/** compliance_reminders.kind values. */
export const REMINDER_KIND = {
  insuranceGrace: 'insurance_grace',
  insuranceDeadline: 'insurance_deadline',
  credentialExpiry: 'credential_expiry',
  licenseDateExpiry: 'license_date_expiry',
  lapse: 'lapse',
} as const

/** compliance_reminders.ref for insurance-grace rows. */
export const INSURANCE_REF = 'insurance'

const DAY_MS = 24 * 60 * 60 * 1000

/** `date` + `days` whole days (UTC arithmetic, keeps time of day). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Grace deadline for an approval timestamp. */
export function graceDeadline(approvedAt: Date): Date {
  return addDays(approvedAt, MALPRACTICE_GRACE_DAYS)
}

/**
 * Whole days left until a timestamp deadline, rounded UP: 13.2 days left is
 * "14 days left"; anything at or past the deadline is <= 0.
 */
export function daysLeftUntil(deadline: Date, now: Date): number {
  // `+ 0` normalizes -0 (just past the deadline) to 0.
  return Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS) + 0
}

/** Today's date (UTC) as YYYY-MM-DD. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Whole calendar days from today (UTC) until a DATE column value
 * (YYYY-MM-DD). The expiration date is the last valid day: 0 = expires
 * today (still valid), negative = expired.
 */
export function daysUntilDate(dateOnly: string, now: Date): number {
  const [y, m, d] = dateOnly.slice(0, 10).split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((target - today) / DAY_MS)
}

/** True when a DATE value (last valid day) is strictly before today (UTC). */
export function isDatePast(dateOnly: string, now: Date): boolean {
  return daysUntilDate(dateOnly, now) < 0
}

/**
 * The reminder threshold that applies for `daysLeft`: the smallest threshold
 * T with daysLeft <= T. Returns null when nothing is due (too early, or
 * already at/after the deadline). Picking only the tightest threshold means a
 * missed cron day never fires two reminders at once; dedupe on
 * (kind, threshold, ref) keeps each threshold to one send.
 *
 *   thresholds [14,7,1]: daysLeft 20 → null, 14 → 14, 9 → 14, 7 → 7, 1 → 1, 0 → null
 */
export function dueThreshold(
  daysLeft: number,
  thresholds: readonly number[]
): number | null {
  if (daysLeft <= 0) return null
  let best: number | null = null
  for (const t of thresholds) {
    if (daysLeft <= t && (best === null || t < best)) best = t
  }
  return best
}

/** "October 31, 2026" for emails / UI. */
export function formatLongDate(value: string | Date): string {
  const date =
    typeof value === 'string' && value.length === 10
      ? new Date(`${value}T12:00:00Z`)
      : new Date(value)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
