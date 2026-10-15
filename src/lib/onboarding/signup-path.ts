// Signup routing (Signup Routing Update spec). The door someone picks on
// /signup → /signup/offer or /signup/looking is stored on
// profiles.signup_path and decides their account type and verification path.
// See supabase/migrations/20261014000100_signup_routing.sql.

import type { Role } from '@/lib/auth/roles'

export const SIGNUP_PATHS = ['INDEPENDENT', 'PRACTICE', 'COMPANY', 'HIRING', 'CLIENT', 'UNSURE'] as const
export type SignupPath = (typeof SIGNUP_PATHS)[number]

/** Doors that land in the organization flow; passed as /signup/organization?source=. */
export const ORG_SIGNUP_PATHS = ['PRACTICE', 'COMPANY', 'HIRING'] as const
export type OrgSignupPath = (typeof ORG_SIGNUP_PATHS)[number]

export function isSignupPath(v: unknown): v is SignupPath {
  return typeof v === 'string' && (SIGNUP_PATHS as readonly string[]).includes(v)
}

export function isOrgSignupPath(v: unknown): v is OrgSignupPath {
  return typeof v === 'string' && (ORG_SIGNUP_PATHS as readonly string[]).includes(v)
}

/** Spec account types. PENDING_CLASSIFICATION is a client-role account awaiting staff placement. */
export type AccountType = 'PROFESSIONAL' | 'ORG_ADMIN' | 'CLIENT' | 'PENDING_CLASSIFICATION'

/** The `profiles.role` each door creates. */
export const ROLE_FOR_PATH: Record<SignupPath, Role> = {
  INDEPENDENT: 'contractor',
  PRACTICE: 'facility',
  COMPANY: 'facility',
  HIRING: 'facility',
  CLIENT: 'client',
  UNSURE: 'client',
}

export const CLASSIFICATION_STATUSES = ['pending', 'needs_info', 'classified', 'rejected'] as const
export type ClassificationStatus = (typeof CLASSIFICATION_STATUSES)[number]

/** Account type from the stored profile fields. */
export function accountTypeFor(profile: {
  role: string | null
  signup_path?: string | null
  classification_status?: string | null
}): AccountType {
  if (profile.signup_path === 'UNSURE' && profile.classification_status === 'pending') {
    return 'PENDING_CLASSIFICATION'
  }
  if (profile.role === 'contractor') return 'PROFESSIONAL'
  if (profile.role === 'facility' || profile.role === 'staffing_agency') return 'ORG_ADMIN'
  return 'CLIENT'
}

/** Not sure accounts awaiting placement: browse, save, book as a client; no messaging. */
export function isPendingClassification(profile: {
  signup_path?: string | null
  classification_status?: string | null
}): boolean {
  return profile.signup_path === 'UNSURE' && profile.classification_status === 'pending'
}

/** Human labels, e.g. for the assignment email ("we've set you up as …") and admin views. */
export const SIGNUP_PATH_LABELS: Record<SignupPath, string> = {
  INDEPENDENT: 'an independent professional',
  PRACTICE: 'a practice, clinic, or facility',
  COMPANY: 'a company or firm',
  HIRING: 'an organization hiring professionals',
  CLIENT: 'a client',
  UNSURE: 'not sure yet',
}

export const SIGNUP_PATH_SHORT_LABELS: Record<SignupPath, string> = {
  INDEPENDENT: 'Independent',
  PRACTICE: 'Practice',
  COMPANY: 'Company',
  HIRING: 'Hiring',
  CLIENT: 'Client',
  UNSURE: 'Not sure',
}

/** Where a person finishes setup for a door once their account exists. */
export const ONBOARDING_PATH_FOR: Record<SignupPath, string> = {
  INDEPENDENT: '/onboarding/professional',
  PRACTICE: '/onboarding/organization',
  COMPANY: '/onboarding/organization',
  HIRING: '/onboarding/organization',
  CLIENT: '/dashboard',
  UNSURE: '/dashboard',
}

/* ───────────── Not sure flow (/signup/unsure step 2) ───────────── */

export const UNSURE_WHAT_YOU_DO_MAX = 300

export const UNSURE_TEAM_SIZES = [
  { value: 'just_me', label: 'Just me' },
  { value: 'small_team', label: 'A small team' },
  { value: 'larger_org', label: 'A larger organization' },
] as const

export const UNSURE_CREDENTIALS = [
  { value: 'state_license', label: 'State license' },
  { value: 'certification', label: 'Certification' },
  { value: 'none', label: 'No' },
] as const

export const UNSURE_WANTS = [
  { value: 'offer_services', label: 'Offer services' },
  { value: 'offer_consulting', label: 'Offer consulting' },
  { value: 'host_events', label: 'Host events or trainings' },
  { value: 'find_professionals', label: 'Find professionals to work with us' },
  { value: 'post_needs', label: 'Post an urgent need or staffing opportunity' },
  { value: 'book_services', label: 'Book services as a client' },
] as const

/** Staff placement choices for a Not sure account. */
export const CLASSIFY_DECISIONS = ['INDEPENDENT', 'PRACTICE', 'COMPANY', 'CLIENT', 'REJECTED'] as const
export type ClassifyDecision = (typeof CLASSIFY_DECISIONS)[number]

/** Above this share of signups choosing Not sure, the door subtitles need rewriting. */
export const UNSURE_SHARE_ALERT = 0.15

/* ───────────── Analytics (PostHog; no PHI) ───────────── */

export const SIGNUP_EVENTS = {
  screenViewed: 'signup_screen_viewed',
  optionSelected: 'signup_option_selected',
  stepViewed: 'signup_step_viewed',
  completed: 'signup_completed',
} as const
