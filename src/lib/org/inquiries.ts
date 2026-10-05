import { HIRING_TIMELINES, LOOKING_FOR_ENGAGEMENTS, labelFor } from '@/lib/onboarding/organization'

export type InquiryKind = 'inquiry' | 'invite'

export const INQUIRY_KIND_LABEL: Record<InquiryKind, string> = {
  inquiry: 'Inquiry',
  invite: 'Invitation to join the team',
}

export const INQUIRY_DAILY_LIMIT = 20 // keep in sync with org_inquiry_daily_limit()

export function inquirySummary(i: { role_title: string; engagement_type: string; timeline: string }): string {
  return `${i.role_title} · ${labelFor(LOOKING_FOR_ENGAGEMENTS, i.engagement_type)} · ${labelFor(HIRING_TIMELINES, i.timeline)}`
}

export const INQUIRY_ERRORS: Record<string, string> = {
  org_not_approved: 'You can contact professionals once your organization is approved.',
  inquiries_off: 'This professional isn’t accepting inquiries right now.',
  rate_limited: `You’ve reached today’s limit of ${INQUIRY_DAILY_LIMIT} inquiries and invites. Try again tomorrow.`,
}
