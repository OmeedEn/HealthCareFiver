/**
 * Provider verification-status helpers safe for both server and client code.
 *
 * 'insurance_pending' means the application WAS approved and the provider is
 * inside the malpractice grace period — treat it as approved for go-live,
 * listings (except malpractice-required ones) and payouts.
 */
export const APPROVED_STATUSES = ['approved', 'insurance_pending'] as const

export function isApprovedStatus(s: string | null | undefined): boolean {
  return s === 'approved' || s === 'insurance_pending'
}

export const PAYOUTS_LOCKED_MESSAGE =
  'You can set up payouts once your application is approved.'
