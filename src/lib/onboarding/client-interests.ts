// Interest categories a client (consumer) picks during signup. Shared by the
// signup page, the /api/auth/signup validator, and the client dashboard so
// the stored keys and their labels never drift apart.
export const CLIENT_INTERESTS = [
  { key: 'clinical', label: 'Clinical care', sub: 'Nursing, telehealth, home visits' },
  { key: 'mental_health', label: 'Mental health & counseling', sub: 'Therapists, psychologists, counselors' },
  { key: 'nutrition', label: 'Nutrition & dietetics', sub: 'RDNs, nutritionists, meal planning' },
  { key: 'coaching', label: 'Health coaching & wellness', sub: 'Behavior change, lifestyle' },
  { key: 'physical_therapy', label: 'Physical therapy & rehab', sub: 'PT, OT, recovery' },
  { key: 'fitness', label: 'Personal training & fitness', sub: 'Trainers, strength, conditioning' },
  { key: 'consulting', label: 'Healthcare consulting or legal advice', sub: 'Attorneys, advisors, specialists' },
  { key: 'education', label: 'Events & continuing education', sub: 'CEU, workshops, certifications' },
  { key: 'other', label: 'Something else', sub: 'Tell us what you need' },
] as const

export type ClientInterestKey = (typeof CLIENT_INTERESTS)[number]['key']

export const CLIENT_INTEREST_KEYS = CLIENT_INTERESTS.map((i) => i.key) as [
  ClientInterestKey,
  ...ClientInterestKey[],
]

export const CLIENT_INTEREST_LABELS: Record<string, string> = Object.fromEntries(
  CLIENT_INTERESTS.map((i) => [i.key, i.label])
)
