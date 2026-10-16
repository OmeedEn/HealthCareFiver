import {
  CLIENT_INTERESTS,
  HELP_TIMELINES,
  MEETING_FORMATS,
  needsZip,
} from '@/lib/onboarding/client-interests'

// Client flow (/signup/client) as configuration: question copy (exact, from
// the Single-Question Onboarding spec), answer type, options, when a screen
// shows, and whether it can be skipped. Reword / reorder here; the page
// (src/app/(flow)/signup/client/page.tsx) renders whatever is listed.
// Account comes last; answers stay in the browser until it exists.

export interface ClientAnswers {
  interests: string[]
  help_timeline: string
  meeting_formats: string[]
  zip_code: string
  /** Question ids answered or skipped (resume = first id not in here). */
  done: string[]
}

export const EMPTY_CLIENT_ANSWERS: ClientAnswers = {
  interests: [],
  help_timeline: '',
  meeting_formats: [],
  zip_code: '',
  done: [],
}

export type ClientQuestionId = 'interests' | 'timeline' | 'formats' | 'zip' | 'account'

export interface ClientQuestion {
  id: ClientQuestionId
  text: string
  type: 'multi' | 'single' | 'zip' | 'account'
  options?: readonly { value: string; label: string; sub?: string }[]
  sub?: string
  helper?: string
  skippable?: boolean
  /** Shown only when this returns true. */
  when?: (a: ClientAnswers) => boolean
}

export const CLIENT_QUESTIONS: ClientQuestion[] = [
  {
    id: 'interests',
    text: 'What kind of help are you looking for?',
    type: 'multi',
    sub: 'Pick all that apply.',
    options: CLIENT_INTERESTS.map((i) => ({ value: i.key, label: i.label, sub: i.sub })),
  },
  {
    id: 'timeline',
    text: 'How soon do you need help?',
    type: 'single',
    options: HELP_TIMELINES,
  },
  {
    id: 'formats',
    text: 'How would you like to meet?',
    type: 'multi',
    sub: 'Pick all that work for you.',
    options: MEETING_FORMATS,
    skippable: true,
  },
  {
    id: 'zip',
    text: "What's your ZIP code?",
    type: 'zip',
    helper: 'Used to show professionals near you.',
    skippable: true,
    when: (a) => needsZip(a.meeting_formats),
  },
  {
    id: 'account',
    text: 'Create your account',
    type: 'account',
    sub: 'Your answers stay private.',
  },
]

/** Results screen title (screen 5, after the account exists). */
export const CLIENT_RESULTS_TITLE = 'Here are professionals who may be a good fit'

export function visibleClientQuestions(a: ClientAnswers): ClientQuestion[] {
  return CLIENT_QUESTIONS.filter((q) => !q.when || q.when(a))
}
