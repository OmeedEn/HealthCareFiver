import type { SignupPath } from '@/lib/onboarding/signup-path'

// Plain helpers for the post-Google account steps, shared by server pages
// and the client screens in src/components/onboarding/account-screens.tsx.

export interface NamePrefill {
  firstName: string
  lastName: string
}

/** True when Google gave us both halves of the name (no name screen needed). */
export function hasFullName(p: NamePrefill): boolean {
  return p.firstName.trim() !== '' && p.lastName.trim() !== ''
}

/**
 * Where each non-professional pick continues. Every target is an account
 * step that converts a brand-new Google account (created as a professional)
 * into the right type. `fromPicker` adds `from=pick`, which gives those
 * steps a back arrow to the picker.
 */
export function accountPathFor(path: SignupPath, fromPicker = true): string | null {
  const back = fromPicker ? 'from=pick' : ''
  const withQuery = (base: string, ...params: string[]) => {
    const q = [...params, back].filter(Boolean).join('&')
    return q ? `${base}?${q}` : base
  }
  switch (path) {
    case 'PRACTICE':
    case 'COMPANY':
    case 'HIRING':
      return withQuery('/onboarding/organization/account', `source=${path}`)
    case 'CLIENT':
      return withQuery('/onboarding/client/account')
    case 'UNSURE':
      return withQuery('/onboarding/unsure')
    default:
      return null
  }
}

