import { UNSURE_CREDENTIALS, UNSURE_TEAM_SIZES } from '@/lib/onboarding/signup-path'

// Not sure flow (/signup/unsure), Single-Question Onboarding spec. Question
// text is the spec's exact copy; ids are what analytics (flowId 'unsure')
// and the pre-account resume use. Reword or reorder here.

export const UNSURE_QUESTIONS = {
  what_you_do: {
    id: 'what_you_do',
    text: 'What do you do?',
    type: 'text',
    placeholder: 'Nurse practitioner running a mobile IV business.',
  },
  team_size: {
    id: 'team_size',
    text: 'Do you work alone or with a team?',
    type: 'single',
    options: UNSURE_TEAM_SIZES,
  },
  credential: {
    id: 'credential',
    text: 'Do you hold a state license or professional certification?',
    type: 'single',
    options: UNSURE_CREDENTIALS,
  },
  website: {
    id: 'website',
    text: 'Share a link to your website or LinkedIn',
    type: 'link',
    placeholder: 'linkedin.com/in/yourname',
    skippable: true,
  },
  account: {
    id: 'account',
    text: 'Create your account',
    type: 'account',
  },
} as const

export type UnsureQuestionId = keyof typeof UNSURE_QUESTIONS

/** Screen order. The account screen comes last. */
export const UNSURE_SCREEN_IDS: readonly UnsureQuestionId[] = [
  'what_you_do',
  'team_size',
  'credential',
  'website',
  'account',
]
