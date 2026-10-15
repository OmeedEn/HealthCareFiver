import { z } from 'zod'
import {
  UNSURE_CREDENTIALS,
  UNSURE_TEAM_SIZES,
  UNSURE_WANTS,
  UNSURE_WHAT_YOU_DO_MAX,
} from '@/lib/onboarding/signup-path'

// Step 2 of /signup/unsure ("Tell us about you"), validated on the server for
// both the email signup (POST /api/auth/signup, role 'unsure') and the
// Google path (/onboarding/unsure). Mirrors the classification_requests
// CHECK constraints in supabase/migrations/20261014000100_signup_routing.sql.

/** Where a brand-new Google account finishes the Not sure signup. */
export const UNSURE_GOOGLE_ACCOUNT_PATH = '/onboarding/unsure'

type TeamSize = (typeof UNSURE_TEAM_SIZES)[number]['value']
type Credential = (typeof UNSURE_CREDENTIALS)[number]['value']
type Want = (typeof UNSURE_WANTS)[number]['value']

function oneOf<T extends string>(options: readonly { value: T }[], message: string) {
  return z.custom<T>(
    (v) => typeof v === 'string' && options.some((o) => o.value === v),
    { message }
  )
}

/** Accepts "linkedin.com/in/…" or a full URL; stored with https://. */
const website = z
  .string()
  .trim()
  .max(300, 'Keep your website or LinkedIn to 300 characters or fewer')
  .optional()
  .transform((v, ctx) => {
    if (!v) return null
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
    try {
      const url = new URL(withScheme)
      if (!url.hostname.includes('.') || /\s/.test(v)) throw new Error('bad host')
      return withScheme.slice(0, 300)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid website or LinkedIn URL' })
      return z.NEVER
    }
  })

export const unsureAnswersSchema = z.object({
  what_you_do: z
    .string({ error: 'Tell us what you do' })
    .trim()
    .min(1, 'Tell us what you do')
    .max(UNSURE_WHAT_YOU_DO_MAX, `Keep “What do you do?” to ${UNSURE_WHAT_YOU_DO_MAX} characters or fewer`),
  team_size: oneOf<TeamSize>(UNSURE_TEAM_SIZES, 'Tell us whether you work alone or with a team'),
  has_location: z.boolean({ error: 'Tell us whether you have a physical location' }),
  credential: oneOf<Credential>(UNSURE_CREDENTIALS, 'Tell us whether you hold a license or certification'),
  website,
  // At least one: staff need some signal of intent to place the account.
  wants: z
    .array(oneOf<Want>(UNSURE_WANTS, 'Pick a valid option for what you want to do'), {
      error: 'Pick at least one thing you want to do on Sanus',
    })
    .min(1, 'Pick at least one thing you want to do on Sanus')
    .max(UNSURE_WANTS.length)
    .transform((v) => Array.from(new Set(v))),
  city: z
    .string({ error: 'City is required' })
    .trim()
    .min(1, 'City is required')
    .max(100, 'City must be 100 characters or fewer'),
  state: z
    .string({ error: 'Select your state' })
    .trim()
    .regex(/^[A-Z]{2}$/, 'Select your state'),
})

export type UnsureAnswers = z.output<typeof unsureAnswersSchema>

/** classification_requests row for a user. Service-role client only. */
export function classificationRequestRow(userId: string, a: UnsureAnswers) {
  return {
    user_id: userId,
    what_you_do: a.what_you_do,
    team_size: a.team_size,
    has_location: a.has_location,
    credential: a.credential,
    website: a.website,
    wants: a.wants,
    city: a.city,
    state: a.state,
  }
}
