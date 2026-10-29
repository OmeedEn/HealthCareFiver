'use client'

import {
  Briefcase,
  Building2,
  CircleHelp,
  HeartHandshake,
  Stethoscope,
  UserSearch,
} from 'lucide-react'
import { IconChoices } from '@/components/onboarding/choices'
import type { ChoiceIcons } from '@/components/onboarding/choice-icons'
import type { Screen } from '@/components/onboarding/question-flow'
import { TextField } from '@/app/onboarding/professional/ui'
import type { SignupPath } from '@/lib/onboarding/signup-path'

/*
 * Screens shared by the post-Google account steps (/onboarding/professional,
 * /onboarding/organization/account, /onboarding/client/account). Google
 * skips the account screen, so these ask only what's still missing: a name
 * when Google didn't share one, and the path's consent checkboxes.
 */

/** "What's your name?" — only shown when Google didn't share one. */
export function nameScreen({
  id = 'account_name',
  step,
  first,
  last,
  setFirst,
  setLast,
}: {
  id?: string
  step?: number
  first: string
  last: string
  setFirst: (v: string) => void
  setLast: (v: string) => void
}): Screen {
  return {
    id,
    step,
    title: 'What’s your name?',
    sub: 'This is how you’ll appear on Sanus.',
    fields: ['first_name', 'last_name'],
    canContinue: () => first.trim() !== '' && last.trim() !== '',
    render: ({ errors }) => (
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id={`${id}-first`}
          label="First name"
          value={first}
          onChange={setFirst}
          autoComplete="given-name"
          maxLength={100}
          error={errors.first_name}
        />
        <TextField
          id={`${id}-last`}
          label="Last name"
          value={last}
          onChange={setLast}
          autoComplete="family-name"
          maxLength={100}
          error={errors.last_name}
        />
      </div>
    ),
  }
}

/* ───────────── "What brings you to Sanus?" (lost signup path) ───────────── */

export const PATH_PICKER_ID = 'account_path'

const PATH_OPTIONS: { value: SignupPath; label: string; sub: string }[] = [
  { value: 'INDEPENDENT', label: 'I offer care on my own', sub: 'Solo practitioner, freelancer, consultant, coach, or educator.' },
  { value: 'PRACTICE', label: 'I run a practice, clinic, or facility', sub: 'We have a location and a team.' },
  { value: 'COMPANY', label: 'I run a company or firm', sub: 'Consulting, training, billing, health tech, or recruiting.' },
  { value: 'HIRING', label: 'I’m hiring professionals', sub: 'Find and book people for shifts, projects, or events.' },
  { value: 'CLIENT', label: 'I’m looking for care', sub: 'For me or someone I care for.' },
  { value: 'UNSURE', label: 'Not sure', sub: 'Tell us a little and we’ll place you.' },
]

const PATH_ICONS: ChoiceIcons = {
  INDEPENDENT: Stethoscope,
  PRACTICE: Building2,
  COMPANY: Briefcase,
  HIRING: UserSearch,
  CLIENT: HeartHandshake,
  UNSURE: CircleHelp,
}

/**
 * First screen for a brand-new Google account that reached professional
 * onboarding without its signup path (the /callback `next` and the hand-off
 * cookie were both lost, or they used Google from /login). Professionals
 * continue in place; everyone else goes to their own account step.
 */
export function pathPickerScreen({
  step,
  value,
  onPick,
}: {
  step?: number
  value: SignupPath | ''
  onPick: (path: SignupPath) => void
}): Screen {
  return {
    id: PATH_PICKER_ID,
    step,
    title: 'What brings you to Sanus?',
    sub: 'So we set up the right kind of account.',
    autoAdvance: true,
    canContinue: () => value === 'INDEPENDENT',
    render: ({ advance }) => (
      <IconChoices
        legend="What brings you to Sanus?"
        hideLegend
        options={PATH_OPTIONS}
        icons={PATH_ICONS}
        columns={1}
        value={value}
        onChange={(v) => {
          onPick(v as SignupPath)
          if (v === 'INDEPENDENT') advance()
        }}
      />
    ),
  }
}
