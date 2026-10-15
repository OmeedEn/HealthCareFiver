'use client'

import { Award, Building2, CircleX, Landmark, User, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/app/onboarding/professional/ui'
import { IconChoices } from '@/components/onboarding/choices'
import type { ChoiceIcons } from '@/components/onboarding/choice-icons'
import type { Screen } from '@/components/onboarding/question-flow'
import { UNSURE_WHAT_YOU_DO_MAX } from '@/lib/onboarding/signup-path'
import { UNSURE_QUESTIONS } from '@/lib/onboarding/questions/unsure'
import { isValidWebsiteAnswer, type UnsureAnswersInput } from '@/lib/onboarding/unsure'

/**
 * Screens 1–4 of the Not sure flow, shared by /signup/unsure (before the
 * account) and /onboarding/unsure (Google sign-in when the answers didn't
 * survive the redirect). Answers are held in the browser
 * (usePreAccountAnswers) until the account exists.
 */
export interface UnsureDraft {
  what_you_do: string
  team_size: string
  credential: string
  website: string
  /** Screen 4 was skipped ("Skip for now"), so resume moves past it. */
  website_skipped: boolean
}

/** sessionStorage key for usePreAccountAnswers. */
export const UNSURE_DRAFT_KEY = 'unsure'

export const EMPTY_UNSURE_DRAFT: UnsureDraft = {
  what_you_do: '',
  team_size: '',
  credential: '',
  website: '',
  website_skipped: false,
}

const TEAM_ICONS: ChoiceIcons = { just_me: User, small_team: Users, larger_org: Building2 }
const CREDENTIAL_ICONS: ChoiceIcons = { state_license: Landmark, certification: Award, none: CircleX }

const whatYouDoOk = (d: UnsureDraft) => {
  const n = d.what_you_do.trim().length
  return n > 0 && n <= UNSURE_WHAT_YOU_DO_MAX
}
const websiteDone = (d: UnsureDraft) => d.website_skipped || isValidWebsiteAnswer(d.website)

/** Index of the first unanswered question screen (4 = all four answered). */
export function unsureResumeIndex(d: UnsureDraft): number {
  if (!whatYouDoOk(d)) return 0
  if (!d.team_size) return 1
  if (!d.credential) return 2
  if (!websiteDone(d)) return 3
  return 4
}

export function unsureDraftComplete(d: UnsureDraft): boolean {
  return unsureResumeIndex(d) === 4
}

/** JSON the server expects (unsureAnswersSchema). Typed text never goes to analytics. */
export function unsureAnswersPayload(d: UnsureDraft): UnsureAnswersInput {
  return {
    what_you_do: d.what_you_do.trim(),
    team_size: d.team_size as UnsureAnswersInput['team_size'],
    credential: d.credential as UnsureAnswersInput['credential'],
    website: !d.website_skipped && d.website.trim() ? d.website.trim() : null,
  }
}

export function unsureQuestionScreens(
  draft: UnsureDraft,
  update: (fn: (prev: UnsureDraft) => UnsureDraft) => void
): Screen[] {
  const q = UNSURE_QUESTIONS
  const websiteTyped = draft.website.trim() !== ''
  return [
    {
      id: q.what_you_do.id,
      title: q.what_you_do.text,
      canContinue: () => whatYouDoOk(draft),
      render: () => (
        <div className="space-y-1.5">
          <Label htmlFor="unsure-what-you-do" className="sr-only">
            {q.what_you_do.text}
          </Label>
          <Input
            id="unsure-what-you-do"
            value={draft.what_you_do}
            onChange={(e) => {
              const v = e.target.value
              update((p) => ({ ...p, what_you_do: v }))
            }}
            placeholder={q.what_you_do.placeholder}
            maxLength={UNSURE_WHAT_YOU_DO_MAX}
            autoComplete="off"
            className="h-14 bg-white text-base sm:text-lg"
          />
        </div>
      ),
    },
    {
      id: q.team_size.id,
      title: q.team_size.text,
      autoAdvance: true,
      canContinue: () => draft.team_size !== '',
      render: ({ advance }) => (
        <IconChoices
          legend={q.team_size.text}
          hideLegend
          options={q.team_size.options}
          icons={TEAM_ICONS}
          value={draft.team_size}
          columns={1}
          onChange={(v) => {
            update((p) => ({ ...p, team_size: v }))
            advance()
          }}
        />
      ),
    },
    {
      id: q.credential.id,
      title: q.credential.text,
      autoAdvance: true,
      canContinue: () => draft.credential !== '',
      render: ({ advance }) => (
        <IconChoices
          legend={q.credential.text}
          hideLegend
          options={q.credential.options}
          icons={CREDENTIAL_ICONS}
          value={draft.credential}
          columns={1}
          onChange={(v) => {
            update((p) => ({ ...p, credential: v }))
            advance()
          }}
        />
      ),
    },
    {
      id: q.website.id,
      title: q.website.text,
      skippable: true,
      onSkip: () => update((p) => ({ ...p, website: '', website_skipped: true })),
      canContinue: () => isValidWebsiteAnswer(draft.website),
      save: async () => {
        update((p) => ({ ...p, website_skipped: false }))
        return { ok: true }
      },
      render: () => (
        <div className="space-y-1.5">
          <Label htmlFor="unsure-website" className="sr-only">
            {q.website.text}
          </Label>
          <Input
            id="unsure-website"
            // Plain text: type="url" would reject "linkedin.com/in/…" without https://.
            type="text"
            inputMode="url"
            autoComplete="url"
            value={draft.website}
            onChange={(e) => {
              const v = e.target.value
              update((p) => ({ ...p, website: v }))
            }}
            placeholder={q.website.placeholder}
            maxLength={300}
            aria-invalid={websiteTyped && !isValidWebsiteAnswer(draft.website) ? true : undefined}
            className="h-14 bg-white text-base sm:text-lg"
          />
          <FieldError
            msg={
              websiteTyped && draft.website.trim().length > 4 && !isValidWebsiteAnswer(draft.website)
                ? 'Enter a valid website or LinkedIn URL'
                : undefined
            }
          />
        </div>
      ),
    },
  ]
}
