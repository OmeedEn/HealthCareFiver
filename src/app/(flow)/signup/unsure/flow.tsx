'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { TERMS_VERSION } from '@/lib/legal'
import { CheckRow } from '@/app/onboarding/professional/ui'
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
import type { ActionResult } from '@/components/onboarding/question-flow'
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

/**
 * Not sure path of /signup: four questions, then the account. Answers stay
 * in this browser tab until the account is created (or, with Google, are
 * handed over in a short-lived cookie). The account is a client with
 * signup_path UNSURE and classification pending; it lands on the
 * dashboard's "we're reviewing your answers" banner until staff place it.
 */
export function useUnsureSignup(): SignupPathFlow {
  const router = useRouter()
  const [draft, setDraft, { hydrated, clear }] = usePreAccountAnswers(UNSURE_DRAFT_KEY, EMPTY_UNSURE_DRAFT)

  // Account screens (never stored: no password in sessionStorage).
  const [account, setAccount] = useState<AccountDraft>(EMPTY_ACCOUNT)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [reviewConsent, setReviewConsent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)
  const email = account.email.trim().toLowerCase()

  async function createAccount(): Promise<ActionResult> {
    if (!unsureDraftComplete(draft)) return { ok: false, error: 'Please answer the earlier questions first.' }
    if (isDemoMode()) {
      finish(false)
      return { ok: true }
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'unsure',
          email,
          password: account.password,
          first_name: account.first_name.trim(),
          last_name: account.last_name.trim(),
          answers: unsureAnswersPayload(draft),
          accepted_terms: true,
          terms_version: TERMS_VERSION,
          review_consent: true,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) return signupErrorResult(res.status, body.error || 'Could not create account')
      trackSignupCompleted('UNSURE')
      finish(!!body.needsEmailConfirmation)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error — please try again' }
    }
  }

  /** After the account exists: the check-email screen, or the dashboard. */
  function finish(needsConfirmation: boolean) {
    clear()
    if (needsConfirmation) {
      setCheckEmail(email)
      return
    }
    // Signed in: the dashboard shows the "we're reviewing your answers"
    // banner (the proxy runs the MFA gate first when it's on).
    router.push('/dashboard')
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
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Google accounts are created as professionals; /onboarding/unsure
        // turns a brand-new one into a Not sure account and asks only for
        // the two consents Google skipped.
        redirectTo: googleRedirectTo(UNSURE_GOOGLE_ACCOUNT_PATH),
      },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  const account3 = accountScreens({
    id: UNSURE_QUESTIONS.account.id,
    title: UNSURE_QUESTIONS.account.text,
    account,
    setAccount: (patch) => setAccount((a) => ({ ...a, ...patch })),
    onGoogle: () => void continueWithGoogle(),
    googleLoading,
    consentValid: acceptedTerms && reviewConsent,
    renderConsent: () => (
      <>
        <TermsConsent checked={acceptedTerms} onChange={setAcceptedTerms} id="unsure-terms" />
        <CheckRow
          id="unsure-review-consent"
          checked={reviewConsent}
          onChange={setReviewConsent}
          label={UNSURE_REVIEW_CONSENT_LABEL}
        />
      </>
    ),
    create: createAccount,
  })

  return {
    hydrated,
    flowId: 'unsure',
    screens: [...unsureQuestionScreens(draft, setDraft), ...account3],
    resumeIndex: unsureResumeIndex(draft),
    done: checkEmail ? (
      <div className="mx-auto w-full max-w-xl">
        <CheckEmailStep
          email={checkEmail}
          onStartOver={() => {
            setAccount(EMPTY_ACCOUNT)
            setAcceptedTerms(false)
            setReviewConsent(false)
            setCheckEmail(null)
          }}
        />
      </div>
    ) : null,
  }
}
