'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
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
import type { ActionResult, Screen } from '@/components/onboarding/question-flow'
import { IconChoices, IconMultiChoices } from '@/components/onboarding/choices'
import {
  CLIENT_INTEREST_ICONS,
  HELP_TIMELINE_ICONS,
  MEETING_FORMAT_ICONS,
} from '@/components/onboarding/client-icons'
import { EmergencyNotice } from '@/components/emergency-notice'
import { CheckRow, TextField } from '@/app/onboarding/professional/ui'
import { CheckEmailStep, TermsConsent, type SignupResponse } from '@/components/auth/signup-shared'
import {
  EMPTY_ACCOUNT,
  accountScreens,
  googleRedirectTo,
  signupErrorResult,
  type AccountDraft,
  type SignupPathFlow,
} from '@/components/auth/signup-account'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'

// Client path of /signup ("Myself or my family"). One question per screen
// from src/lib/onboarding/questions/client.ts; the account comes last
// (email, password, name + 18+ and Terms). Answers live in this tab's
// sessionStorage until the account is created (or are handed to the Google
// account step in a short-lived cookie) — never before.

const ZIP_RE = /^\d{5}$/

/** "No preference" can't be combined with a specific format. */
function toggleFormats(next: string[], prev: string[]): string[] {
  const added = next.find((v) => !prev.includes(v))
  if (added === 'no_preference') return ['no_preference']
  if (added) return next.filter((v) => v !== 'no_preference')
  return next
}

export function useClientSignup(): SignupPathFlow {
  const router = useRouter()
  const [answers, setAnswers, { hydrated, clear }] = usePreAccountAnswers<ClientAnswers>(
    'client',
    EMPTY_CLIENT_ANSWERS
  )
  // Account details stay in memory only (never in storage).
  const [account, setAccount] = useState<AccountDraft>(EMPTY_ACCOUNT)
  const [adult, setAdult] = useState(false)
  const [terms, setTerms] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)

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

  async function createAccount(): Promise<ActionResult> {
    if (isDemoMode()) {
      router.push('/find-care')
      return { ok: true }
    }
    const { zip_code, ...rest } = payload()
    const email = account.email.trim().toLowerCase()
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'client',
          email,
          password: account.password,
          first_name: account.first_name.trim(),
          last_name: account.last_name.trim(),
          ...rest,
          ...(zip_code ? { zip_code } : {}),
          adult_attested: true,
          accepted_terms: true,
          terms_version: TERMS_VERSION,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) return signupErrorResult(res.status, body.error || 'Could not create account')
      trackSignupCompleted('CLIENT')
      // Saved to the account now; drop the browser copy.
      clear()
      if (body.needsEmailConfirmation) setCheckEmail(email)
      else router.replace(CLIENT_MATCHES_PATH)
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
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Google accounts are created as professionals; the account step
        // turns a brand-new one into a client and collects consent + 18+.
        redirectTo: googleRedirectTo(CLIENT_GOOGLE_ACCOUNT_PATH),
      },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  function toScreens(q: ClientQuestion): Screen[] {
    const base = { id: q.id, title: q.text, sub: q.sub }
    switch (q.id) {
      case 'interests':
        return [
          {
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
          },
        ]
      case 'timeline':
        return [
          {
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
          },
        ]
      case 'formats':
        return [
          {
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
          },
        ]
      case 'zip':
        return [
          {
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
          },
        ]
      case 'account':
        return accountScreens({
          id: q.id,
          title: q.text,
          sub: q.sub,
          account,
          setAccount: (patch) => setAccount((prev) => ({ ...prev, ...patch })),
          onGoogle: () => void continueWithGoogle(),
          googleLoading,
          consentValid: adult && terms,
          renderConsent: () => (
            <>
              <CheckRow id="adult" checked={adult} onChange={setAdult} label="I'm 18 or older." />
              <TermsConsent checked={terms} onChange={setTerms} />
            </>
          ),
          create: createAccount,
        })
    }
  }

  const questions = visibleClientQuestions(answers)
  const screens = questions.flatMap(toScreens)
  // Resume on the first screen not yet answered or skipped. The account is
  // last, so a question's index is also its first screen's index.
  const resume = Math.max(
    0,
    questions.findIndex((q) => !answers.done.includes(q.id))
  )

  return {
    hydrated,
    flowId: 'client',
    screens,
    resumeIndex: resume,
    done: checkEmail ? (
      <div className="mx-auto max-w-xl">
        <CheckEmailStep
          email={checkEmail}
          onStartOver={() => {
            setCheckEmail(null)
            setAccount(EMPTY_ACCOUNT)
            setAdult(false)
            setTerms(false)
          }}
        />
      </div>
    ) : null,
  }
}
