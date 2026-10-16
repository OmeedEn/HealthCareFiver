/**
 * Dashboard greeting helper. The old contractor "Get set up" checklist that
 * lived here was replaced by the Finish your profile checklist
 * (./checklist-professional.ts).
 */

const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * "Welcome" (first-run) vs "Welcome back": an account is treated as new for
 * its first 7 days, or for as long as its setup is incomplete.
 */
export function isNewAccount({
  createdAt,
  setupComplete,
  now = Date.now(),
}: {
  createdAt: string | null | undefined
  setupComplete: boolean
  now?: number
}): boolean {
  if (!setupComplete) return true
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return now - created < NEW_ACCOUNT_WINDOW_MS
}
