/**
 * Sanus fee on organization bookings: a percentage taken from the
 * organization's payout (the customer pays the listed price). 10% unless
 * BOOKING_FEE_PERCENT says otherwise. The fee is locked in on each booking
 * when it's paid, so changing this only affects new payments.
 */
export const DEFAULT_BOOKING_FEE_PERCENT = 10

export function bookingFeePercent(): number {
  const raw = process.env.BOOKING_FEE_PERCENT?.trim()
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : DEFAULT_BOOKING_FEE_PERCENT
}

export function bookingFeeCents(amountCents: number, percent = bookingFeePercent()): number {
  return Math.round((amountCents * percent) / 100)
}
