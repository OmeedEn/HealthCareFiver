/**
 * Applicant pipeline labels (Organization Onboarding spec: New, Shortlisted,
 * Interviewing, Offered, Hired, Not selected). The stored values are the
 * application_status enum; only the words change.
 */
export const PIPELINE_LABEL: Record<string, string> = {
  applied: 'New',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offered: 'Offered',
  accepted: 'Hired',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
}

/** Same statuses as the applicant sees them. */
export const MY_APPLICATION_LABEL: Record<string, string> = {
  ...PIPELINE_LABEL,
  applied: 'Applied',
}

export interface ScreeningAnswer {
  question: string
  answer: string
}
