// Where the one /signup flow opens (src/app/(flow)/signup/signup-flow.tsx).
// `/signup?start=<door|choice>` preselects that answer; the old door URLs
// (/signup/offer, /signup/professional, /signup/organization?source=…, …)
// redirect here with it.

export type SignupDoorAnswer = 'offer' | 'looking'
export type SignupChoice = 'independent' | 'practice' | 'company' | 'unsure' | 'client' | 'hiring'
/** A door (opens its sub-choice screen) or a choice (opens that path). */
export type SignupStart = SignupDoorAnswer | SignupChoice

export const DOOR_OF_CHOICE: Record<SignupChoice, SignupDoorAnswer> = {
  independent: 'offer',
  practice: 'offer',
  company: 'offer',
  unsure: 'offer',
  client: 'looking',
  hiring: 'looking',
}

const STARTS: readonly string[] = ['offer', 'looking', ...Object.keys(DOOR_OF_CHOICE)]

type SearchParams = { [key: string]: string | string[] | undefined }

export function parseSignupStart(raw: unknown): SignupStart | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && STARTS.includes(v) ? (v as SignupStart) : null
}

/**
 * /signup?start=… for a redirect from an old door URL, keeping any other
 * query parameters (e.g. utm_* on marketing links). `drop` names parameters
 * the old URL consumed (e.g. `source`).
 */
export function signupStartUrl(start: SignupStart | null, params: SearchParams = {}, drop: string[] = []): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (k === 'start' || drop.includes(k) || v === undefined) continue
    for (const one of Array.isArray(v) ? v : [v]) q.append(k, one)
  }
  if (start) q.set('start', start)
  const s = q.toString()
  return s ? `/signup?${s}` : '/signup'
}
