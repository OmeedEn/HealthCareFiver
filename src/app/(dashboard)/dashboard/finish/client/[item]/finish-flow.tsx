'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Banknote, CircleEllipsis } from 'lucide-react'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { IconChoices } from '@/components/onboarding/choices'
import { TextAreaField, TextField } from '@/app/onboarding/professional/ui'
import { Button } from '@/components/ui/button'
import { formatUsPhoneInput } from '@/lib/phone'
import {
  CLIENT_BUDGETS,
  CLIENT_GOALS_MAX,
  CLIENT_LANGUAGE_MAX,
  CLIENT_NOTE_MAX,
} from '@/lib/onboarding/client-interests'
import type { ClientFinishItem } from '@/lib/onboarding/checklist-client'
import { saveClientFinishItem } from './actions'

const LANGUAGES = [
  'English',
  'Spanish',
  'Mandarin',
  'Cantonese',
  'Vietnamese',
  'Tagalog',
  'Korean',
  'Arabic',
  'Farsi',
  'Armenian',
  'Russian',
  'Hindi',
  'French',
  'Portuguese',
  'American Sign Language',
]

const BUDGET_ICONS = Object.fromEntries(
  CLIENT_BUDGETS.map((b) => [b.value, b.value === 'flexible' ? CircleEllipsis : Banknote])
)

/** One dashboard "Finish your profile" item as a single-question screen. */
export function ClientFinishFlow({
  item,
  initial,
  email,
}: {
  item: ClientFinishItem
  initial: string
  email: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [sending, setSending] = useState(false)

  const save = () => saveClientFinishItem(item, value)
  const nonEmpty = () => value.trim().length > 0
  const err = (errors: Record<string, string>) => errors.value

  const screens: Record<ClientFinishItem, Screen> = {
    verify_email: {
      id: 'verify_email',
      title: 'Verify your email',
      sub: `We sent a confirmation link to ${email}. Open it to verify your email before you inquire or book.`,
      continueLabel: 'Back to dashboard',
      render: () => (
        <Button
          type="button"
          variant="outline"
          disabled={sending}
          className="h-11 w-full"
          onClick={async () => {
            setSending(true)
            try {
              const res = await fetch('/api/auth/resend-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              })
              if (res.status === 429) toast.error('Too many requests. Please wait and try again.')
              else toast.success('If your email still needs confirming, we’ve sent a new link.')
            } catch {
              toast.error('Network error — please try again')
            } finally {
              setSending(false)
            }
          }}
        >
          Resend the email
        </Button>
      ),
    },
    zip: {
      id: 'zip',
      title: "What's your ZIP code?",
      canContinue: () => /^\d{5}$/.test(value),
      save,
      fields: ['value'],
      render: ({ errors }) => (
        <TextField
          id="value"
          label="ZIP code"
          value={value}
          onChange={(v) => setValue(v.replace(/\D/g, '').slice(0, 5))}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          hint="Used to show professionals near you."
          error={err(errors)}
        />
      ),
    },
    goals: {
      id: 'goals',
      title: 'What are your goals?',
      sub: 'A few words is plenty. Please don’t include medical details.',
      canContinue: nonEmpty,
      save,
      fields: ['value'],
      render: ({ errors }) => (
        <TextAreaField
          id="value"
          label="Your goals"
          value={value}
          onChange={setValue}
          maxLength={CLIENT_GOALS_MAX}
          counter
          placeholder="e.g. get stronger, sleep better, eat healthier"
          error={err(errors)}
        />
      ),
    },
    language: {
      id: 'language',
      title: 'What language would you like to meet in?',
      canContinue: nonEmpty,
      save,
      fields: ['value'],
      render: ({ errors }) => (
        <>
          <TextField
            id="value"
            label="Language"
            value={value}
            onChange={setValue}
            list="client-languages"
            maxLength={CLIENT_LANGUAGE_MAX}
            placeholder="e.g. Spanish"
            error={err(errors)}
          />
          <datalist id="client-languages">
            {LANGUAGES.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </>
      ),
    },
    budget: {
      id: 'budget',
      title: 'What’s your budget per session?',
      autoAdvance: true,
      canContinue: nonEmpty,
      save,
      render: ({ advance }) => (
        <IconChoices
          legend="Budget per session"
          hideLegend
          options={CLIENT_BUDGETS}
          icons={BUDGET_ICONS}
          value={value}
          onChange={(v) => {
            setValue(v)
            advance()
          }}
          columns={1}
        />
      ),
    },
    note: {
      id: 'note',
      title: 'Anything else we should know?',
      sub: 'Please don’t include medical details.',
      canContinue: nonEmpty,
      save,
      fields: ['value'],
      render: ({ errors }) => (
        <TextAreaField
          id="value"
          label="Anything else"
          value={value}
          onChange={setValue}
          maxLength={CLIENT_NOTE_MAX}
          counter
          placeholder="e.g. evenings work best, I prefer a female provider"
          error={err(errors)}
        />
      ),
    },
    phone: {
      id: 'phone',
      title: 'What’s your phone number?',
      sub: 'Used for appointment reminders.',
      canContinue: () => value.replace(/\D/g, '').length >= 10,
      save,
      fields: ['value'],
      render: ({ errors }) => (
        <TextField
          id="value"
          label="Phone number"
          type="tel"
          value={value}
          onChange={(v) => setValue(formatUsPhoneInput(v))}
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          placeholder="(555) 555-5555"
          error={err(errors)}
        />
      ),
    },
  }

  return (
    <QuestionFlow
      screens={[screens[item]]}
      initialIndex={0}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="client_finish"
      onExit={() => router.push('/dashboard')}
      onFinish={() => {
        router.push('/dashboard')
        router.refresh()
      }}
    />
  )
}
