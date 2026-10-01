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
  languages?: string[] | null
}

/**
 * Profile inputs that live outside contractor_profiles. Each check only runs
 * when its value is provided, so callers that don't know them skip it.
 */
export type ProfileExtras = {
  /** profiles.avatar_url (headshot) */
  avatarUrl?: string | null
  /** Rows in contractor_availability that aren't blocks. */
  availabilitySlots?: number
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

/**
 * What a client needs to evaluate a professional: the public profile at
 * /pros/[id]. Headline, bio, headshot, languages, specialties and location are
 * edited on /contractor/profile/edit; availability on /contractor/availability.
 * Prices live on listings now, and license details are collected (and
 * verified) during onboarding, so neither is part of "profile" any more.
 */
export function getProfileCompleteness(
  profile: ProfileFields | null | undefined,
  extras: ProfileExtras = {}
): ProfileCompleteness {
  const p = profile ?? {}
  const checks: { label: string; ok: boolean }[] = [
    { label: 'headline', ok: hasText(p.headline) },
    { label: 'bio', ok: hasText(p.bio) },
  ]
  if (extras.avatarUrl !== undefined) {
    checks.push({ label: 'headshot', ok: hasText(extras.avatarUrl) })
  }
  checks.push(
    {
      label: 'languages',
      ok: Array.isArray(p.languages) && p.languages.some(hasText),
    },
    {
      label: 'specialties',
      ok: Array.isArray(p.specialties) && p.specialties.some(hasText),
    },
    { label: 'location', ok: hasText(p.city) && hasText(p.state) }
  )
  if (extras.availabilitySlots !== undefined) {
    checks.push({ label: 'availability', ok: extras.availabilitySlots > 0 })
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
  | 'agreement'
  | 'payouts'
  | 'listing'

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
  /** profiles.avatar_url; omit to skip the headshot check. */
  avatarUrl?: string | null
  /** Non-blocked contractor_availability rows; omit to skip the check. */
  availabilitySlots?: number
  credentialCount: number
  verificationStatus: string | null | undefined
  /** profiles.stripe_connect_id — set once Connect onboarding is started. */
  stripeConnectId: string | null | undefined
  /** profiles.stripe_connect_onboarded — set by the account.updated webhook. */
  stripeConnectOnboarded: boolean | null | undefined
  /**
   * contractor_profiles.contractor_agreement_accepted_at. Going live =
   * verification approved AND this set (accepted on /go-live).
   */
  agreementAcceptedAt: string | null | undefined
  /** The provider's professional_offerings by status; omit to skip. */
  listings?: { total: number; published: number; inReview: number }
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
    case 'insurance_pending':
      return {
        ...base,
        state: 'done',
        detail:
          'Approved — upload your malpractice certificate to unlock every listing type.',
        href: '/contractor/credentials/upload?type=malpractice_insurance',
        cta: 'Upload certificate',
      }
    case 'suspended':
      return {
        ...base,
        state: 'action_needed',
        detail: 'Suspended — see the note above for what to do.',
      }
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
  const profile = getProfileCompleteness(input.profile, {
    avatarUrl: input.avatarUrl,
    availabilitySlots: input.availabilitySlots,
  })
  const credentialCount = Math.max(0, input.credentialCount || 0)
  const verificationStatus = input.verificationStatus ?? 'not_submitted'
  // 'insurance_pending' = approved, inside the malpractice grace period.
  const isApproved =
    verificationStatus === 'approved' ||
    verificationStatus === 'insurance_pending'
  const profileHref =
    profile.missing.length === 1 && profile.missing[0] === 'availability'
      ? '/contractor/availability'
      : '/contractor/profile/edit'

  const items: ChecklistItem[] = [
    profile.complete
      ? {
          key: 'profile',
          title: 'Complete your profile',
          state: 'done',
          detail: 'Your profile has everything clients look for.',
        }
      : {
          key: 'profile',
          title: 'Complete your profile',
          state: 'todo',
          detail: `Add your ${joinList(profile.missing)}.`,
          href: profileHref,
          cta:
            profileHref === '/contractor/availability'
              ? 'Set availability'
              : 'Edit profile',
        },
    credentialCount > 0
      ? {
          key: 'credentials',
          title: 'Upload documents',
          state: 'done',
          detail: `${credentialCount} credential${credentialCount === 1 ? '' : 's'} uploaded.`,
        }
      : {
          key: 'credentials',
          title: 'Upload documents',
          state: 'todo',
          detail: 'Add your license or certification and a government ID.',
          href: '/contractor/credentials/upload',
          cta: 'Upload',
        },
    verificationItem(verificationStatus, credentialCount),
    input.agreementAcceptedAt
      ? {
          key: 'agreement',
          title: 'Accept the provider agreement',
          state: 'done',
          detail: 'Accepted — you’re live on Sanus.',
        }
      : !isApproved
        ? {
            key: 'agreement',
            title: 'Accept the provider agreement',
            state: 'locked',
            detail: 'Available once your application is approved.',
          }
        : {
            key: 'agreement',
            title: 'Accept the provider agreement',
            state: 'todo',
            detail: 'Accept the agreement to publish your first listing.',
            href: '/go-live',
            cta: 'Go live',
          },
    input.stripeConnectOnboarded
      ? {
          key: 'payouts',
          title: 'Set up payouts',
          state: 'done',
          detail: 'Stripe payouts are connected.',
        }
      : !isApproved
        ? {
            key: 'payouts',
            title: 'Set up payouts',
            state: 'locked',
            detail: 'Available once your application is approved.',
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
  ]

  if (input.listings) {
    const { total, published, inReview } = input.listings
    items.push(
      published > 0
        ? {
            key: 'listing',
            title: 'Publish your first listing',
            state: 'done',
            detail: 'Your first listing is live.',
          }
        : inReview > 0
          ? {
              key: 'listing',
              title: 'Publish your first listing',
              state: 'in_progress',
              detail: 'In review — we’ll let you know when it’s live.',
              href: '/contractor/listings',
              cta: 'View listings',
            }
          : total > 0
            ? {
                key: 'listing',
                title: 'Publish your first listing',
                state: 'todo',
                detail: isApproved
                  ? 'You have a draft — review it and submit it for review.'
                  : 'Draft saved. You can submit it once your application is approved.',
                href: '/contractor/listings',
                cta: 'Review',
              }
            : {
                key: 'listing',
                title: 'Publish your first listing',
                state: 'todo',
                detail:
                  'Create a service, consulting offer, or event. Save it as a draft anytime.',
                href: '/contractor/listings/new',
                cta: 'Create listing',
              }
    )
  }

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
