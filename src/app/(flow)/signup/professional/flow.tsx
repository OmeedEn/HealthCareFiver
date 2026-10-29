'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { TERMS_VERSION } from '@/lib/legal'
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
  firstOpenIdentityScreen,
  identityScreens,
} from '@/components/onboarding/professional/identity-screens'
import { usePreAccountAnswers } from '@/lib/onboarding/pre-account'
import { writeProSignupCookie } from '@/lib/onboarding/professional-google'
import {
  EMPTY_PRO_ANSWERS,
  PRO_COPY,
  PRO_PRE_ACCOUNT_KEY,
  PRO_Q,
  branchOf,
  postAccountScreenIds,
  type ProSignupAnswers,
} from '@/lib/onboarding/questions/professional'

/**
 * Professional path of /signup (Independent professional): category,
 * profession, license / certifying organization / link, then the account
 * (email, password, name + Terms). Answers stay in this browser tab until
 * the account is created; screens 5–8 continue at /onboarding/professional.
 */
export function useProfessionalSignup(): SignupPathFlow {
  const router = useRouter()
  const [answers, setAnswers, { hydrated, clear }] = usePreAccountAnswers<ProSignupAnswers>(
    PRO_PRE_ACCOUNT_KEY,
    EMPTY_PRO_ANSWERS
  )
  // The account fields (incl. the password) are never written to storage.
  const [account, setAccount] = useState<AccountDraft>(EMPTY_ACCOUNT)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)

  const set = (patch: Partial<ProSignupAnswers>) => setAnswers((a) => ({ ...a, ...patch }))
  const email = account.email.trim().toLowerCase()

  const branch = branchOf(answers)
  const pre = identityScreens({ answers, set })

  async function createAccount(): Promise<ActionResult> {
    if (isDemoMode()) {
      finish(false)
      return { ok: true }
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'contractor',
          signup_path: 'INDEPENDENT',
          email,
          password: account.password,
          first_name: account.first_name.trim(),
          last_name: account.last_name.trim(),
          contractor_type: 'other',
          accepted_terms: true,
          terms_version: TERMS_VERSION,
          answers,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) return signupErrorResult(res.status, body.error || 'Could not create your account.')
      trackSignupCompleted('INDEPENDENT')
      finish(!!body.needsEmailConfirmation)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error. Please try again.' }
    }
  }

  /** After the account exists: the check-email screen, or on to onboarding. */
  function finish(needsConfirmation: boolean) {
    // Answers now live on the account; drop the browser copy.
    clear()
    if (needsConfirmation) {
      setCheckEmail(email)
      return
    }
    router.push('/onboarding/professional')
    router.refresh()
  }

  async function continueWithGoogle() {
    if (googleLoading) return
    setGoogleLoading(true)
    if (isDemoMode()) {
      router.push('/onboarding/account')
      return
    }
    // Screens 1–3 ride along in a short-lived cookie; /onboarding/account
    // saves them once the Google account exists.
    writeProSignupCookie(answers)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: googleRedirectTo('/onboarding/account') },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  const account3 = accountScreens({
    id: PRO_Q.account,
    title: PRO_COPY.account,
    sub: PRO_COPY.accountSub,
    account,
    setAccount: (patch) => setAccount((a) => ({ ...a, ...patch })),
    onGoogle: () => void continueWithGoogle(),
    googleLoading,
    consentValid: acceptedTerms,
    renderConsent: () => <TermsConsent checked={acceptedTerms} onChange={setAcceptedTerms} />,
    create: createAccount,
    // Stands in for screens 5–8 too, so the bar shows how far along they
    // really are rather than "done" at the account.
    extraWeight: postAccountScreenIds(branch).length,
  })

  return {
    hydrated,
    flowId: 'professional',
    screens: [...pre, ...account3],
    resumeIndex: firstOpenIdentityScreen(pre),
    done: checkEmail ? (
      <div className="mx-auto max-w-md">
        <CheckEmailStep
          email={checkEmail}
          onStartOver={() => {
            setCheckEmail(null)
            setAccount(EMPTY_ACCOUNT)
            setAcceptedTerms(false)
          }}
        />
      </div>
    ) : null,
  }
}
