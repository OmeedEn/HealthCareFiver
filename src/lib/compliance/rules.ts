/**
 * Pure compliance rules (no I/O) shared by the daily compliance cron and the
 * approval / clear-hold transitions. Kept dependency-free for unit testing.
 */

import { HOLD_REASON_PREFIX, formatLongDate, isDatePast } from './config'

export type CredentialRow = {
  id: string
  contractor_id: string
  credential_type: string
  name: string | null
  status: string
  expiration_date: string | null
}

/** Statuses meaning "an admin verified this and it hasn't been superseded". */
export const VALID_CREDENTIAL_STATUSES = ['verified', 'expiring_soon'] as const
/** Statuses a once-verified credential can be in (the cron flips verified → expired). */
export const ONCE_VERIFIED_STATUSES = ['verified', 'expiring_soon', 'expired'] as const

function isValidStatus(status: string): boolean {
  return (VALID_CREDENTIAL_STATUSES as readonly string[]).includes(status)
}
function isOnceVerified(status: string): boolean {
  return (ONCE_VERIFIED_STATUSES as readonly string[]).includes(status)
}

/** A verified credential of this type that is current today (null expiry = no expiry). */
export function hasCurrentCredential(
  creds: CredentialRow[],
  type: string,
  now: Date
): boolean {
  return creds.some(
    (c) =>
      c.credential_type === type &&
      isValidStatus(c.status) &&
      (c.expiration_date === null || !isDatePast(c.expiration_date, now))
  )
}

/**
 * True when a newer verified credential of the same type expires after
 * `cred` — then reminders about `cred` are noise (the provider renewed).
 */
export function isSuperseded(cred: CredentialRow, all: CredentialRow[]): boolean {
  if (!cred.expiration_date) return false
  return all.some(
    (c) =>
      c.id !== cred.id &&
      c.contractor_id === cred.contractor_id &&
      c.credential_type === cred.credential_type &&
      isValidStatus(c.status) &&
      (c.expiration_date === null || c.expiration_date > cred.expiration_date!)
  )
}

export type Lapse = {
  /** compliance_reminders.ref — credential id, or `license_date:<date>`. */
  ref: string
  /** Human label for emails ("license", "government ID", …). */
  label: string
  /** The last valid day (YYYY-MM-DD). */
  expirationDate: string
}

export type HoldLapse = Lapse & { holdReason: string }

export const CREDENTIAL_LABELS: Record<string, string> = {
  license: 'license',
  certification: 'certification',
  government_id: 'government ID',
  malpractice_insurance: 'malpractice insurance',
}

export function credentialLabel(cred: Pick<CredentialRow, 'credential_type' | 'name'>): string {
  return CREDENTIAL_LABELS[cred.credential_type] ?? cred.name ?? 'credential'
}

function latestLapsed(
  creds: CredentialRow[],
  type: string,
  now: Date
): CredentialRow | null {
  const lapsed = creds
    .filter(
      (c) =>
        c.credential_type === type &&
        isOnceVerified(c.status) &&
        c.expiration_date !== null &&
        isDatePast(c.expiration_date, now)
    )
    .sort((a, b) => (a.expiration_date! < b.expiration_date! ? 1 : -1))
  return lapsed[0] ?? null
}

/**
 * The lapse that should put this provider on a compliance hold (hidden from
 * search; can_go_live false), or null. Checked in order: the self-reported
 * contractor_profiles.license_expiration_date, then license, certification
 * and government ID credentials. A lapse is cured by a verified credential of
 * the same type that is current today (for the profile date: a current
 * verified license credential expiring after that date).
 */
export function findHoldLapse(
  profile: { license_expiration_date: string | null },
  creds: CredentialRow[],
  now: Date
): HoldLapse | null {
  const profileDate = profile.license_expiration_date
  if (profileDate && isDatePast(profileDate, now)) {
    const renewed = creds.some(
      (c) =>
        c.credential_type === 'license' &&
        isValidStatus(c.status) &&
        c.expiration_date !== null &&
        !isDatePast(c.expiration_date, now) &&
        c.expiration_date > profileDate
    )
    if (!renewed) {
      return {
        ref: `license_date:${profileDate}`,
        label: 'license',
        expirationDate: profileDate,
        holdReason: `${HOLD_REASON_PREFIX.license}${formatLongDate(profileDate)}.`,
      }
    }
  }

  for (const type of ['license', 'certification', 'government_id'] as const) {
    if (hasCurrentCredential(creds, type, now)) continue
    const lapsed = latestLapsed(creds, type, now)
    if (lapsed) {
      return {
        ref: lapsed.id,
        label: credentialLabel(lapsed),
        expirationDate: lapsed.expiration_date!,
        holdReason: `${HOLD_REASON_PREFIX[type]}${formatLongDate(lapsed.expiration_date!)}.`,
      }
    }
  }
  return null
}

/**
 * Malpractice lapse for a provider whose Insured badge is on: every verified
 * malpractice certificate has expired. Null when still covered (or when the
 * provider never had a verified certificate).
 */
export function findMalpracticeLapse(
  profile: { insured_verified_at: string | null },
  creds: CredentialRow[],
  now: Date
): Lapse | null {
  if (!profile.insured_verified_at) return null
  if (hasCurrentCredential(creds, 'malpractice_insurance', now)) return null
  const lapsed = latestLapsed(creds, 'malpractice_insurance', now)
  if (!lapsed) return null
  return {
    ref: lapsed.id,
    label: credentialLabel(lapsed),
    expirationDate: lapsed.expiration_date!,
  }
}

/** True when the provider has a verified, unexpired malpractice certificate. */
export function hasCurrentMalpractice(creds: CredentialRow[], now: Date): boolean {
  return hasCurrentCredential(creds, 'malpractice_insurance', now)
}

/** True when a hold reason was written by the lapse cron (vs. set manually). */
export function isAutomatedHold(reason: string | null | undefined): boolean {
  if (!reason) return false
  return Object.values(HOLD_REASON_PREFIX).some((p) => reason.startsWith(p))
}
