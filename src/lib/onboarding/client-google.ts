import { z } from 'zod'
import {
  HELP_TIMELINE_VALUES,
  MEETING_FORMAT_VALUES,
  normalizeClientInterests,
  type HelpTimeline,
  type MeetingFormat,
} from '@/lib/onboarding/client-interests'

// "Continue with Google" on /signup/client leaves the site before the account
// exists, so the answers given so far (interests, how soon, how to meet, ZIP)
// ride along in a short-lived cookie. /onboarding/client/account reads it
// once the Google account is created. A cookie, not a query param: the MFA
// redirect between /callback and that page drops the query string.

export const CLIENT_GOOGLE_ACCOUNT_PATH = '/onboarding/client/account'
export const CLIENT_SIGNUP_COOKIE = 'sanus_client_signup'
export const CLIENT_SIGNUP_COOKIE_MAX_AGE = 60 * 60

export interface ClientSignupAnswers {
  interests: string[]
  help_timeline: HelpTimeline | null
  meeting_formats: MeetingFormat[]
  zip_code: string | null
  /** Only older cookies (the previous client signup) carry a city/state. */
  city: string | null
  state: string | null
}

const FORMAT_SET = new Set<string>(MEETING_FORMAT_VALUES)

// Lenient on purpose: the cookie is user-controlled, so drop anything invalid
// rather than block the signup.
const answersSchema = z.object({
  interests: z.array(z.string()).max(20).catch([]),
  help_timeline: z.enum(HELP_TIMELINE_VALUES).nullish().catch(null),
  meeting_formats: z.array(z.string()).max(10).catch([]),
  city: z.string().trim().max(100).nullish().catch(null),
  state: z.string().trim().regex(/^[A-Z]{2}$/).nullish().catch(null),
  zip_code: z.string().trim().regex(/^\d{5}$/).nullish().catch(null),
})

export function parseClientSignupCookie(raw: string | undefined): ClientSignupAnswers {
  let json: unknown = null
  try {
    json = raw ? JSON.parse(decodeURIComponent(raw)) : null
  } catch {
    json = null
  }
  const parsed = answersSchema.safeParse(json ?? {})
  const data = parsed.success ? parsed.data : answersSchema.parse({})
  return {
    interests: normalizeClientInterests(data.interests),
    help_timeline: data.help_timeline ?? null,
    meeting_formats: Array.from(
      new Set(data.meeting_formats.filter((f) => FORMAT_SET.has(f)))
    ) as MeetingFormat[],
    zip_code: data.zip_code || null,
    city: data.city || null,
    state: data.state || null,
  }
}

/** Browser only: stash the answers so far before redirecting to Google. */
export function writeClientSignupCookie(
  answers: Pick<ClientSignupAnswers, 'interests' | 'help_timeline' | 'meeting_formats' | 'zip_code'>
): void {
  const value = encodeURIComponent(JSON.stringify(answers))
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CLIENT_SIGNUP_COOKIE}=${value}; Path=/; Max-Age=${CLIENT_SIGNUP_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}
