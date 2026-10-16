'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { TERMS_VERSION } from '@/lib/legal'
import { TextField, CheckRow } from '@/app/onboarding/professional/ui'
import { CheckEmailStep, TermsConsent, type SignupResponse } from '@/components/auth/signup-shared'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import {
  EMPTY_UNSURE_DRAFT,
  UNSURE_DRAFT_KEY,
  unsureAnswersPayload,
  unsureDraftComplete,
  unsureQuestionScreens,
  unsureResumeIndex,
} from '@/components/onboarding/unsure-questions'
import { usePreAccountAnswers } from '@/lib/onboarding/pre-account'
import { UNSURE_QUESTIONS } from '@/lib/onboarding/questions/unsure'
import {
  UNSURE_GOOGLE_ACCOUNT_PATH,
  UNSURE_REVIEW_CONSENT_LABEL,
  writeUnsureSignupCookie,
} from '@/lib/onboarding/unsure'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Not sure signup (Single-Question Onboarding spec): four questions, then
 * the account. Answers stay in this browser tab until the account screen
 * sends them with the signup request (or, with Google, hands them over in a
 * short-lived cookie). The account is a client with signup_path UNSURE and
 * classification pending; it lands on the dashboard's "we're reviewing your
 * answers" banner until staff place it.
 */
export function UnsureSignupFlow() {
  const router = useRouter()
  const [draft, setDraft, { hydrated, clear }] = usePreAccountAnswers(UNSURE_DRAFT_KEY, EMPTY_UNSURE_DRAFT)

  // Account screen (never stored: no password in sessionStorage).
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [reviewConsent, setReviewConsent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)
  const needsConfirmation = useRef(false)

  const accountValid =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    EMAIL_RE.test(email.trim()) &&
    password.length >= 8 &&
    acceptedTerms &&
    reviewConsent

  async function createAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!unsureDraftComplete(draft)) return { ok: false, error: 'Please answer the earlier questions first.' }
    if (isDemoMode()) return { ok: true }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'unsure',
          email: email.trim().toLowerCase(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          answers: unsureAnswersPayload(draft),
          accepted_terms: true,
          terms_version: TERMS_VERSION,
          review_consent: true,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: body.error || 'Could not create account' }
      trackSignupCompleted('UNSURE')
      needsConfirmation.current = !!body.needsEmailConfirmation
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error — please try again' }
    }
  }

  async function continueWithGoogle() {
    if (googleLoading) return
    if (!unsureDraftComplete(draft)) {
      toast.error('Please answer the earlier questions first.')
      return
    }
    setGoogleLoading(true)
    if (isDemoMode()) {
      router.push(UNSURE_GOOGLE_ACCOUNT_PATH)
      return
    }
    writeUnsureSignupCookie(unsureAnswersPayload(draft))
    const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Google accounts are created as professionals; /onboarding/unsure
        // turns a brand-new one into a Not sure account and asks only for
        // the two consents Google skipped.
        redirectTo: `${origin}/callback?next=${UNSURE_GOOGLE_ACCOUNT_PATH}`,
      },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <CheckEmailStep
          email={checkEmail}
          onStartOver={() => {
            setEmail('')
            setPassword('')
            setAcceptedTerms(false)
            setReviewConsent(false)
            setCheckEmail(null)
          }}
        />
      </div>
    )
  }

  // Resume needs the stored answers; render once they're loaded.
  if (!hydrated) return null

  const accountScreen: Screen = {
    id: UNSURE_QUESTIONS.account.id,
    title: UNSURE_QUESTIONS.account.text,
    continueLabel: 'Create account',
    canContinue: () => accountValid,
    save: createAccount,
    render: () => (
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          onClick={continueWithGoogle}
          disabled={googleLoading}
          className="h-11 w-full bg-white text-sm font-semibold"
        >
          {googleLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-[#95979d]">
          <div className="h-px flex-1 bg-[#e4e5e7]" />
          or use your email
          <div className="h-px flex-1 bg-[#e4e5e7]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField id="unsure-first" label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" maxLength={100} />
          <TextField id="unsure-last" label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" maxLength={100} />
        </div>
        <TextField
          id="unsure-email"
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={254}
        />
        <TextField
          id="unsure-password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          maxLength={200}
          error={password.length > 0 && password.length < 8 ? `At least 8 characters (${password.length}/8)` : undefined}
        />
        <div className="space-y-3">
          <TermsConsent checked={acceptedTerms} onChange={setAcceptedTerms} id="unsure-terms" />
          <CheckRow
            id="unsure-review-consent"
            checked={reviewConsent}
            onChange={setReviewConsent}
            label={UNSURE_REVIEW_CONSENT_LABEL}
          />
        </div>
      </div>
    ),
  }

  const screens = [...unsureQuestionScreens(draft, setDraft), accountScreen]

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={unsureResumeIndex(draft)}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="unsure"
      onExit={() => router.push('/signup/offer')}
      onFinish={() => {
        clear()
        if (needsConfirmation.current) {
          setCheckEmail(email.trim().toLowerCase())
          return
        }
        // Signed in: the dashboard shows the "we're reviewing your answers"
        // banner (the proxy runs the MFA gate first when it's on).
        router.push('/dashboard')
      }}
    />
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
