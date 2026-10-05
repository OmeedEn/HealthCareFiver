/**
 * Listing claims (Provider Onboarding spec: "we can't allow 'cure' or
 * guaranteed-results claims").
 *
 * BLOCKED: refused when a provider or organization saves a listing.
 * RISKY:   broader list the admin listing review highlights for a human
 *          to judge ("reverse", "100%" can be legitimate).
 */

const BLOCKED_RE =
  /\b(cur(?:e|es|ed|ing)|miracle(?:s)?|miraculous)\b|\bguarantee(?:s|d)?\b(?:\s+\w+){0,3}?\s+(?:results?|outcomes?|recovery|weight\s+loss|to\s+(?:work|heal|fix|cure|lose|improve))\b|\b(?:results?|outcomes?)\s+(?:are\s+)?guaranteed\b/gi

export const RISKY_CLAIMS_RE =
  /\b(cur(?:e|es|ed|ing)|guarantee(?:s|d)?|miracle(?:s)?|miraculous|revers(?:e|es|ed|ing|al))\b|100\s?%/gi

function matches(re: RegExp, text: string): string[] {
  return [...new Set((text.match(re) ?? []).map((w) => w.toLowerCase().replace(/\s+/g, ' ')))]
}

/** Blocked phrases found across the given fields (empty = OK to save). */
export function findBlockedClaims(...fields: (string | null | undefined)[]): string[] {
  return matches(BLOCKED_RE, fields.filter(Boolean).join('\n'))
}

export function riskyClaimWords(text: string): string[] {
  return matches(RISKY_CLAIMS_RE, text)
}

export function blockedClaimsMessage(found: string[]): string {
  return `Listings can’t promise cures or guaranteed results. Please reword: ${found.map((f) => `“${f}”`).join(', ')}.`
}
