'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { TERMS_VERSION } from '@/lib/legal'
import { HELP_TIMELINE_VALUES, MEETING_FORMAT_VALUES, needsZip } from '@/lib/onboarding/client-interests'
import {
  CLIENT_GOOGLE_ACCOUNT_PATH,
  writeClientSignupCookie,
} from '@/lib/onboarding/client-google'
import {
  EMPTY_CLIENT_ANSWERS,
  visibleClientQuestions,
  type ClientAnswers,
  type ClientQuestion,
} from '@/lib/onboarding/questions/client'
import { usePreAccountAnswers } from '@/lib/onboarding/pre-account'
import { CLIENT_MATCHES_PATH } from '@/lib/find-care/match-shared'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { IconChoices, IconMultiChoices } from '@/components/onboarding/choices'
import {
  CLIENT_INTEREST_ICONS,
  HELP_TIMELINE_ICONS,
  MEETING_FORMAT_ICONS,
} from '@/components/onboarding/client-icons'
import { EmergencyNotice } from '@/components/emergency-notice'
import { CheckRow, TextField } from '@/app/onboarding/professional/ui'
import { CheckEmailStep, TermsConsent, type SignupResponse } from '@/components/auth/signup-shared'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'

// Client signup (Single-Question Onboarding spec, "Myself or my family").
// One question per screen from src/lib/onboarding/questions/client.ts; the
// account comes last. Answers live in this tab's sessionStorage until the
// account screen sends them with the signup request (or hands them to the
// Google account step in a short-lived cookie) — never before.

const ZIP_RE = /^\d{5}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Account {
  firstName: string
  lastName: string
  email: string
  password: string
  adult: boolean
  terms: boolean
}

const EMPTY_ACCOUNT: Account = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  adult: false,
  terms: false,
}

function accountValid(a: Account): boolean {
  return (
    !!a.firstName.trim() &&
    !!a.lastName.trim() &&
    EMAIL_RE.test(a.email.trim()) &&
    a.password.length >= 8 &&
    a.adult &&
    a.terms
  )
}

/** "No preference" can't be combined with a specific format. */
function toggleFormats(next: string[], prev: string[]): string[] {
  const added = next.find((v) => !prev.includes(v))
  if (added === 'no_preference') return ['no_preference']
  if (added) return next.filter((v) => v !== 'no_preference')
  return next
}

export default function ClientSignupPage() {
  const router = useRouter()
  const [answers, setAnswers, { hydrated, clear }] = usePreAccountAnswers<ClientAnswers>(
    'client',
    EMPTY_CLIENT_ANSWERS
  )
  // Account details stay in memory only (never in storage).
  const [account, setAccount] = useState<Account>(EMPTY_ACCOUNT)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)
  // Read by onFinish in the same tick as the signup response (state would be stale).
  const awaitingConfirmation = useRef(false)

  if (!hydrated) {
    return (
      <div className="flex justify-center py-24" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-[#95979d]" aria-label="Loading" />
      </div>
    )
  }

  if (checkEmail) {
    return (
      <div className="mx-auto max-w-xl">
        <CheckEmailStep
          email={checkEmail}
          onStartOver={() => {
            awaitingConfirmation.current = false
            setCheckEmail(null)
            setAccount(EMPTY_ACCOUNT)
          }}
        />
      </div>
    )
  }

  const update = (patch: Partial<ClientAnswers>) => setAnswers((prev) => ({ ...prev, ...patch }))
  const markDone = (id: string) =>
    setAnswers((prev) => (prev.done.includes(id) ? prev : { ...prev, done: [...prev.done, id] }))
  const done = (id: string) => async () => {
    markDone(id)
    return { ok: true as const }
  }

  /** What leaves the browser: only answers for screens they'd see. */
  function payload() {
    const zip = needsZip(answers.meeting_formats) && ZIP_RE.test(answers.zip_code) ? answers.zip_code : null
    const timeline = HELP_TIMELINE_VALUES.find((t) => t === answers.help_timeline) ?? null
    return {
      interests: answers.interests,
      help_timeline: timeline,
      meeting_formats: MEETING_FORMAT_VALUES.filter((f) => answers.meeting_formats.includes(f)),
      zip_code: zip,
    }
  }

  async function createAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (isDemoMode()) return { ok: true }
    const { zip_code, ...rest } = payload()
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'client',
          email: account.email.trim().toLowerCase(),
          password: account.password,
          first_name: account.firstName.trim(),
          last_name: account.lastName.trim(),
          ...rest,
          ...(zip_code ? { zip_code } : {}),
          adult_attested: true,
          accepted_terms: true,
          terms_version: TERMS_VERSION,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: body.error || 'Could not create account' }
      trackSignupCompleted('CLIENT')
      // Saved to the account now; drop the browser copy.
      clear()
      if (body.needsEmailConfirmation) {
        awaitingConfirmation.current = true
        setCheckEmail(account.email.trim().toLowerCase())
      }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error — please try again' }
    }
  }

  async function continueWithGoogle() {
    if (googleLoading) return
    setGoogleLoading(true)
    if (isDemoMode()) {
      router.push(CLIENT_GOOGLE_ACCOUNT_PATH)
      return
    }
    writeClientSignupCookie(payload())
    const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Google accounts are created as professionals; the account step
        // turns a brand-new one into a client and collects consent + 18+.
        redirectTo: `${origin}/callback?next=${CLIENT_GOOGLE_ACCOUNT_PATH}`,
      },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  function toScreen(q: ClientQuestion): Screen {
    const base = { id: q.id, title: q.text, sub: q.sub }
    switch (q.id) {
      case 'interests':
        return {
          ...base,
          canContinue: () => answers.interests.length > 0,
          save: done(q.id),
          render: () => (
            <IconMultiChoices
              legend={q.text}
              hideLegend
              options={q.options!}
              icons={CLIENT_INTEREST_ICONS}
              value={answers.interests}
              onChange={(v) => update({ interests: v })}
              columns={2}
            />
          ),
        }
      case 'timeline':
        return {
          ...base,
          autoAdvance: true,
          canContinue: () => !!answers.help_timeline,
          save: done(q.id),
          render: ({ advance }) => (
            <>
              <IconChoices
                legend={q.text}
                hideLegend
                options={q.options!}
                icons={HELP_TIMELINE_ICONS}
                value={answers.help_timeline}
                onChange={(v) => {
                  update({ help_timeline: v })
                  advance()
                }}
                columns={1}
              />
              <EmergencyNotice />
            </>
          ),
        }
      case 'formats':
        return {
          ...base,
          skippable: q.skippable,
          onSkip: () => markDone(q.id),
          canContinue: () => answers.meeting_formats.length > 0,
          save: done(q.id),
          render: () => (
            <IconMultiChoices
              legend={q.text}
              hideLegend
              options={q.options!}
              icons={MEETING_FORMAT_ICONS}
              value={answers.meeting_formats}
              onChange={(v) => update({ meeting_formats: toggleFormats(v, answers.meeting_formats) })}
              columns={2}
            />
          ),
        }
      case 'zip':
        return {
          ...base,
          skippable: q.skippable,
          onSkip: () => {
            update({ zip_code: '' })
            markDone(q.id)
          },
          canContinue: () => ZIP_RE.test(answers.zip_code),
          save: done(q.id),
          render: () => (
            <TextField
              id="zip"
              label="ZIP code"
              value={answers.zip_code}
              onChange={(v) => update({ zip_code: v.replace(/\D/g, '').slice(0, 5) })}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder="12345"
              hint={q.helper}
            />
          ),
        }
      case 'account':
        return {
          ...base,
          continueLabel: 'Create account',
          canContinue: () => accountValid(account),
          save: createAccount,
          render: () => (
            <AccountFields
              account={account}
              onChange={(patch) => setAccount((prev) => ({ ...prev, ...patch }))}
              onGoogle={() => void continueWithGoogle()}
              googleLoading={googleLoading}
            />
          ),
        }
    }
  }

  const questions = visibleClientQuestions(answers)
  const screens = questions.map(toScreen)
  // Resume on the first screen not yet answered or skipped.
  const resume = Math.max(
    0,
    questions.findIndex((q) => !answers.done.includes(q.id))
  )

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={resume}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="client"
      onExit={() => router.push('/signup/looking')}
      onFinish={() => {
        if (isDemoMode()) router.push('/find-care')
        // Email confirmation pending → the check-email screen is showing.
        else if (!awaitingConfirmation.current) router.replace(CLIENT_MATCHES_PATH)
      }}
    />
  )
}

function AccountFields({
  account,
  onChange,
  onGoogle,
  googleLoading,
}: {
  account: Account
  onChange: (patch: Partial<Account>) => void
  onGoogle: () => void
  googleLoading: boolean
}) {
  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        disabled={googleLoading}
        className="h-11 w-full text-sm font-semibold"
      >
        {googleLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-[#95979d]">
        <div className="h-px flex-1 bg-[#e4e5e7]" />
        or use your email
        <div className="h-px flex-1 bg-[#e4e5e7]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="first_name"
          label="First name"
          value={account.firstName}
          onChange={(v) => onChange({ firstName: v })}
          autoComplete="given-name"
          maxLength={100}
        />
        <TextField
          id="last_name"
          label="Last name"
          value={account.lastName}
          onChange={(v) => onChange({ lastName: v })}
          autoComplete="family-name"
          maxLength={100}
        />
      </div>
      <TextField
        id="email"
        label="Email"
        type="email"
        value={account.email}
        onChange={(v) => onChange({ email: v })}
        autoComplete="email"
        placeholder="you@example.com"
        maxLength={254}
      />
      <TextField
        id="password"
        label="Password"
        type="password"
        value={account.password}
        onChange={(v) => onChange({ password: v })}
        autoComplete="new-password"
        maxLength={200}
        hint={
          account.password.length > 0 && account.password.length < 8
            ? `At least 8 characters (${account.password.length}/8).`
            : 'At least 8 characters.'
        }
      />

      <div className="space-y-1">
        <CheckRow
          id="adult"
          checked={account.adult}
          onChange={(v) => onChange({ adult: v })}
          label="I'm 18 or older."
        />
        <TermsConsent checked={account.terms} onChange={(v) => onChange({ terms: v })} />
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
