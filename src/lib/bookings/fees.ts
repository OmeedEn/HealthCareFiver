/**
 * Sanus fee on organization bookings: a percentage taken from the
 * organization's payout (the customer pays the listed price).
 *
 * DEFAULT-OFF. No fee rate has been approved, so there is deliberately no
 * fallback percentage: while BOOKING_FEE_PERCENT is unset (or not a sane
 * number) bookingFeePercent() returns null and paid booking stays closed
 * (see bookingPaymentsEnabled). Do not reintroduce a default rate here — an
 * approved rate must be set explicitly. The fee is locked in on each booking
 * when it's paid, so changing the env var only affects new payments.
 */
export function bookingFeePercent(): number | null {
  const raw = process.env.BOOKING_FEE_PERCENT?.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : null
}

/** Fee for an amount, or null while no fee rate is configured. */
export function bookingFeeCents(amountCents: number, percent = bookingFeePercent()): number | null {
  if (percent == null) return null
  return Math.round((amountCents * percent) / 100)
}

/**
 * Paid booking is open only when Stripe is configured AND an approved fee
 * rate has been set explicitly. Either missing → customers see "payments
 * aren't open yet" and checkout refuses.
 */
export function bookingPaymentsEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && bookingFeePercent() != null
}
