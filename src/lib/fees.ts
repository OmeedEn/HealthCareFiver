/**
 * Sanus service fee on bookings.
 *
 * The fee percentage is NOT decided yet. It is configured with the server-only
 * env var PLATFORM_FEE_PERCENT (e.g. "12" or "12.5"). While it is unset — or
 * not a sane number — every helper returns null and the UI shows
 * FEE_BEING_FINALIZED instead of a made-up number.
 *
 * SERVER ONLY: PLATFORM_FEE_PERCENT is not a NEXT_PUBLIC_ var, so on the client
 * this always reads as null. Compute the breakdown on the server and pass the
 * result down.
 */

export const FEE_BEING_FINALIZED =
  "Sanus service fee: being finalized — you'll see the exact amount here before your listing goes live."

export function getPlatformFeePercent(): number | null {
  const raw = process.env.PLATFORM_FEE_PERCENT
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw.trim())
  if (!Number.isFinite(n) || n < 0 || n >= 100) return null
  return n
}

export type FeeBreakdown = { feeCents: number; payoutCents: number }

/** Fee and provider payout for a price, or null while the fee is undecided. */
export function feeBreakdown(
  priceCents: number | null | undefined
): FeeBreakdown | null {
  const pct = getPlatformFeePercent()
  if (pct == null) return null
  if (priceCents == null || !Number.isFinite(priceCents) || priceCents < 0) {
    return null
  }
  const cents = Math.round(priceCents)
  const feeCents = Math.round((cents * pct) / 100)
  return { feeCents, payoutCents: cents - feeCents }
}
