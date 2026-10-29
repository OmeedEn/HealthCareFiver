// "Light signup, verify later" for buyers. Organizations that came through
// the Hiring door (profiles.signup_path = 'HIRING') only answer type, name
// and city/state before the dashboard opens. The rest of the organization
// flow (website, license, registration upload, attestations → submit) is
// asked the first time they do something that needs a verified organization:
// posting a staffing need or job, requesting a booking, or contacting a
// professional. Practice and Company (sellers) still finish the whole flow
// before the dashboard.
//
// Pure: safe in the proxy, on the server and in the browser.

import { orgAnswerOnFile, orgFlowDataFromRow } from '@/lib/onboarding/questions/organization'

/** Only an explicit Hiring signup verifies later; legacy (null) doors keep the full flow. */
export function verifiesLater(signupPath: string | null | undefined): boolean {
  return signupPath === 'HIRING'
}

/** The screens a Hiring organization answers before the dashboard opens. */
export const ORG_LIGHT_IDS = ['org_type', 'org_name', 'org_location'] as const

/** facility_profiles columns orgLightSetupDone reads (all publicly selectable). */
export const ORG_LIGHT_COLUMNS = 'org_type, org_type_other, facility_name, city, state'

/** True when type, name and city/state are on file (any facility_profiles row shape). */
export function orgLightSetupDone(row: Record<string, unknown>): boolean {
  const flow = orgFlowDataFromRow(row, [])
  return ORG_LIGHT_IDS.every((id) => orgAnswerOnFile(id, flow, 'HIRING'))
}

/** What sent them into verification; shapes one line of copy above the flow. */
export const VERIFY_REASONS = ['post', 'book', 'contact'] as const
export type VerifyReason = (typeof VERIFY_REASONS)[number]

export function isVerifyReason(v: unknown): v is VerifyReason {
  return typeof v === 'string' && (VERIFY_REASONS as readonly string[]).includes(v)
}

/** 'any': opened from the dashboard rather than from a specific action. */
export const VERIFY_REASON_COPY: Record<VerifyReason | 'any', string> = {
  any: 'Verify your organization to post staffing needs, book, and contact professionals. It takes about two minutes.',
  post: 'Before you post, let’s verify your organization. It takes about two minutes, and we’ll bring you right back.',
  book: 'Before you book, let’s verify your organization. It takes about two minutes, and we’ll bring you right back.',
  contact:
    'Before you contact professionals, let’s verify your organization. It takes about two minutes, and we’ll bring you right back.',
}

/** A same-site path to return to, or null. Rejects absolute and protocol-relative URLs. */
export function safeNextPath(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string' || v.length > 500) return null
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\r\n]/.test(v)) return null
  return v
}

export const ORG_VERIFY_PATH = '/onboarding/organization'

/** Where to send a Hiring organization that hasn't verified yet. */
export function orgVerifyHref(reason: VerifyReason, next?: string | null): string {
  const params = new URLSearchParams({ verify: reason })
  const back = safeNextPath(next)
  if (back) params.set('next', back)
  return `${ORG_VERIFY_PATH}?${params.toString()}`
}
