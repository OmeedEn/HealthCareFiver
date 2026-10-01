import { isLiveSubscription } from '../auth/can-go-live'

/**
 * Contractor "Get set up" checklist, computed from real account state.
 *
 * Pure (no I/O) so the dashboard can fetch the inputs however it likes and
 * this logic stays easy to unit test. contractor_profiles.profile_completion_pct
 * is NOT used: it is only written when the profile edit form is saved, so it
 * is 0 for every new account and goes stale whenever the definition changes.
 */

export type ProfileFields = {
  professional_category?: string | null
  headline?: string | null
  bio?: string | null
  specialties?: string[] | null
  hourly_rate_min?: number | string | null
  hourly_rate_max?: number | string | null
  city?: string | null
  state?: string | null
  state_license_number?: string | null
  license_state?: string | null
}

export type ProfileCompleteness = {
  complete: boolean
  /** Human-readable labels of what is still missing, in display order. */
  missing: string[]
  filled: number
  total: number
}

function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

function hasNumber(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) && n > 0
  }
  return false
}

/**
 * What a facility/client needs to evaluate a professional. Every field here
 * is editable on /contractor/profile/edit. License info is only required for
 * the 'clinical' category — consultants, educators and allied practitioners
 * may not hold a state license.
 */
export function getProfileCompleteness(
  profile: ProfileFields | null | undefined
): ProfileCompleteness {
  const p = profile ?? {}
  const checks: { label: string; ok: boolean }[] = [
    { label: 'headline', ok: hasText(p.headline) },
    { label: 'bio', ok: hasText(p.bio) },
    {
      label: 'specialties',
      ok: Array.isArray(p.specialties) && p.specialties.some(hasText),
    },
    {
      label: 'hourly rate',
      ok: hasNumber(p.hourly_rate_min) || hasNumber(p.hourly_rate_max),
    },
    { label: 'location', ok: hasText(p.city) && hasText(p.state) },
  ]
  if (p.professional_category === 'clinical') {
    checks.push({
      label: 'license info',
      ok: hasText(p.state_license_number) && hasText(p.license_state),
    })
  }
  const missing = checks.filter((c) => !c.ok).map((c) => c.label)
  return {
    complete: missing.length === 0,
    missing,
    filled: checks.length - missing.length,
    total: checks.length,
  }
}

export type ChecklistItemKey =
  | 'profile'
  | 'credentials'
  | 'verification'
  | 'payouts'
  | 'go_live'

export type ChecklistItemState =
  | 'done'
  | 'todo'
  | 'in_progress'
  | 'action_needed'
  | 'locked'

export type ChecklistItem = {
  key: ChecklistItemKey
  title: string
  /** Honest one-line status for the current state. */
  detail: string
  state: ChecklistItemState
  /** Where to go to act on it; omitted when there is nothing to do yet. */
  href?: string
  cta?: string
}

export type ContractorChecklistInput = {
  profile: ProfileFields | null | undefined
  credentialCount: number
  verificationStatus: string | null | undefined
  /** profiles.stripe_connect_id — set once Connect onboarding is started. */
  stripeConnectId: string | null | undefined
  /** profiles.stripe_connect_onboarded — set by the account.updated webhook. */
  stripeConnectOnboarded: boolean | null | undefined
  subscriptionStatus: string | null | undefined
}

export type ContractorChecklist = {
  items: ChecklistItem[]
  completed: number
  total: number
  allDone: boolean
  profile: ProfileCompleteness
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

function verificationItem(
  status: string,
  credentialCount: number
): ChecklistItem {
  const base = { key: 'verification' as const, title: 'Get verified' }
  switch (status) {
    case 'approved':
      return { ...base, state: 'done', detail: 'Approved — you’re verified.' }
    case 'pending_review':
      return {
        ...base,
        state: 'in_progress',
        detail: 'Under review — usually takes 24–48 hours.',
      }
    case 'more_info_requested':
      return {
        ...base,
        state: 'action_needed',
        detail: 'Action needed — our team requested more information.',
        href: '/contractor/credentials/upload',
        cta: 'Upload document',
      }
    case 'rejected':
      return {
        ...base,
        state: 'action_needed',
        detail: 'Not approved — see the note above or contact support.',
      }
    case 'not_submitted':
    default:
      return {
        ...base,
        state: 'todo',
        detail:
          credentialCount > 0
            ? 'Not started — submit your documents for review.'
            : 'Not started — upload credentials to submit for review.',
        href: '/contractor/credentials/upload',
        cta: 'Submit for review',
      }
  }
}

export function buildContractorChecklist(
  input: ContractorChecklistInput
): ContractorChecklist {
  const profile = getProfileCompleteness(input.profile)
  const credentialCount = Math.max(0, input.credentialCount || 0)
  const verificationStatus = input.verificationStatus ?? 'not_submitted'
  const isApproved = verificationStatus === 'approved'
  const subscriptionStatus = input.subscriptionStatus ?? null

  const items: ChecklistItem[] = [
    profile.complete
      ? {
          key: 'profile',
          title: 'Complete your profile',
          state: 'done',
          detail: 'Your profile has everything facilities look for.',
        }
      : {
          key: 'profile',
          title: 'Complete your profile',
          state: 'todo',
          detail: `Add your ${joinList(profile.missing)}.`,
          href: '/contractor/profile/edit',
          cta: 'Edit profile',
        },
    credentialCount > 0
      ? {
          key: 'credentials',
          title: 'Upload credentials',
          state: 'done',
          detail: `${credentialCount} credential${credentialCount === 1 ? '' : 's'} uploaded.`,
        }
      : {
          key: 'credentials',
          title: 'Upload credentials',
          state: 'todo',
          detail: 'Add your license or certification and a government ID.',
          href: '/contractor/credentials/upload',
          cta: 'Upload',
        },
    verificationItem(verificationStatus, credentialCount),
    input.stripeConnectOnboarded
      ? {
          key: 'payouts',
          title: 'Set up payouts',
          state: 'done',
          detail: 'Stripe payouts are connected.',
        }
      : input.stripeConnectId
        ? {
            key: 'payouts',
            title: 'Set up payouts',
            state: 'in_progress',
            detail: 'Started — finish your Stripe setup to get paid.',
            href: '/contractor/payments',
            cta: 'Finish setup',
          }
        : {
            key: 'payouts',
            title: 'Set up payouts',
            state: 'todo',
            detail: 'Connect a bank account through Stripe to get paid.',
            href: '/contractor/payments',
            cta: 'Set up',
          },
    isLiveSubscription(subscriptionStatus)
      ? {
          key: 'go_live',
          title: 'Go live',
          state: 'done',
          detail: 'Your listing is live.',
        }
      : !isApproved
        ? {
            key: 'go_live',
            title: 'Go live',
            state: 'locked',
            detail: 'Available once you’re verified ($29/mo).',
          }
        : subscriptionStatus === 'past_due'
          ? {
              key: 'go_live',
              title: 'Go live',
              state: 'action_needed',
              detail: 'Payment issue — update billing to stay live.',
              href: '/subscribe',
              cta: 'Fix billing',
            }
          : {
              key: 'go_live',
              title: 'Go live',
              state: 'todo',
              detail: 'Activate your listing ($29/mo) to apply to jobs.',
              href: '/subscribe',
              cta: 'Activate',
            },
  ]

  const completed = items.filter((i) => i.state === 'done').length
  return {
    items,
    completed,
    total: items.length,
    allDone: completed === items.length,
    profile,
  }
}

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
