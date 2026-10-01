/**
 * Automatic red-flag hints for the organization review (spec: "Free email
 * only, no web presence…"). Hints only — an admin makes the call.
 */

export { FREE_EMAIL_DOMAINS } from '@/lib/onboarding/organization'
import { FREE_EMAIL_DOMAINS } from '@/lib/onboarding/organization'

export function emailDomain(email: string | null | undefined): string {
  return (email ?? '').split('@')[1]?.trim().toLowerCase() ?? ''
}

export function websiteDomain(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

export interface OrgRedFlagInput {
  email: string | null
  website: string | null
}

/** Flags we can detect from what the org entered. */
export function detectOrgRedFlags({ email, website }: OrgRedFlagInput): string[] {
  const flags: string[] = []
  const eDomain = emailDomain(email)
  const wDomain = websiteDomain(website)
  if (FREE_EMAIL_DOMAINS.has(eDomain)) flags.push(`Signed up with a free email address (${eDomain})`)
  if (!wDomain) flags.push('No website given')
  else if (eDomain && !FREE_EMAIL_DOMAINS.has(eDomain) && !eDomain.endsWith(wDomain) && !wDomain.endsWith(eDomain)) {
    flags.push(`Email domain (${eDomain}) doesn’t match the website (${wDomain})`)
  }
  return flags
}
