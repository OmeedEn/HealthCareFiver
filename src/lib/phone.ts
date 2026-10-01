/**
 * US phone helpers (NANP only for now).
 *
 * Storage format: E.164 — `+1` followed by 10 digits, e.g. `+15551234567`.
 * That's what `profiles.phone` holds for anyone who signed up through the
 * professional flow, and what SMS/voice providers expect without further
 * massaging. Display formatting is purely a UI concern (`formatUsPhone`).
 */

/** Strip everything but digits. */
function digitsOf(input: string): string {
  return input.replace(/\D/g, '')
}

/**
 * Normalize user input to E.164 (`+1XXXXXXXXXX`), or null if it isn't a
 * plausible US number. Accepts any punctuation, an optional leading `+1`/`1`,
 * and rejects area codes / exchanges starting with 0 or 1 (invalid in NANP).
 */
export function normalizeUsPhone(input: string | null | undefined): string | null {
  if (!input) return null
  let d = digitsOf(input)
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  if (d.length !== 10) return null
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null
  return `+1${d}`
}

/**
 * Light as-you-type formatting: `5551234567` → `(555) 123-4567`. Leaves a
 * leading country code off; caps at 10 national digits.
 */
export function formatUsPhoneInput(input: string): string {
  let d = digitsOf(input)
  if (d.length > 10 && d.startsWith('1')) d = d.slice(1)
  d = d.slice(0, 10)
  if (d.length === 0) return ''
  if (d.length < 4) return `(${d}`
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

/** Pretty-print a stored E.164 US number; falls back to the raw value. */
export function formatUsPhone(stored: string | null | undefined): string {
  if (!stored) return ''
  const normalized = normalizeUsPhone(stored)
  return normalized ? formatUsPhoneInput(normalized.slice(2)) : stored
}

export const PHONE_ERROR = 'Enter a valid US phone number'
