/**
 * Quick-pick languages for contractor_profiles.languages. Professionals can
 * also add any language not listed here.
 */
export const COMMON_LANGUAGES = [
  'English',
  'Spanish',
  'Mandarin',
  'Cantonese',
  'Tagalog',
  'Vietnamese',
  'Arabic',
  'French',
  'Korean',
  'Russian',
  'Portuguese',
  'Hindi',
  'Farsi',
  'Armenian',
  'Japanese',
  'German',
  'American Sign Language (ASL)',
] as const

export const MAX_LANGUAGES = 20
export const MAX_LANGUAGE_LENGTH = 50

/** Trim, collapse whitespace, de-duplicate case-insensitively, and cap. */
export function normalizeLanguages(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LANGUAGE_LENGTH)
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= MAX_LANGUAGES) break
  }
  return out
}
