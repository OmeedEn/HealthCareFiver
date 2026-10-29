'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { ORG_AGREEMENT_VERSION, TERMS_VERSION } from '@/lib/legal'
import { isFreeEmail } from '@/lib/onboarding/organization'
import { ORG_QUESTIONS } from '@/lib/onboarding/questions/organization'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'
import { writeOrgSignupSourceCookie } from '@/lib/onboarding/org-signup-source'
import { usePreAccountAnswers } from '@/lib/onboarding/pre-account'
import type { ActionResult } from '@/components/onboarding/question-flow'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'
import { CheckEmailStep, type SignupResponse } from '@/components/auth/signup-shared'
import {
  EMAIL_RE,
  EMPTY_ACCOUNT,
  accountScreens,
  googleRedirectTo,
  signupErrorResult,
  type AccountDraft,
  type SignupPathFlow,
} from '@/components/auth/signup-account'
import { OrgTermsConsent } from '@/components/org/org-terms-consent'
import { EMPTY_ORG_ANSWERS, nameScreen, typeScreen, type OrgAnswers } from '@/app/onboarding/organization/org-screens'
import { isOrgTypeAllowed } from '@/app/onboarding/organization/shared'

// Organization path of /signup (Practice, Company, or Hiring door):
// organization type and name are held in this browser tab only
// (sessionStorage) until the account is created, or the Google path carries
// them in a short-lived cookie. Screens 4–8 continue at
// /onboarding/organization.

const ONBOARDING_PATH = '/onboarding/organization'
const GOOGLE_ACCOUNT_PATH = '/onboarding/organization/account'

type PreAccount = Pick<OrgAnswers, 'org_type' | 'org_type_other' | 'facility_name'>

export function useOrganizationSignup(source: OrgSignupPath): SignupPathFlow {
  const router = useRouter()
  const [answers, setAnswers, { hydrated, clear }] = usePreAccountAnswers<PreAccount>(`organization:${source}`, {
    org_type: '',
    org_type_other: '',
    facility_name: '',
  })
  const [account, setAccount] = useState<AccountDraft>(EMPTY_ACCOUNT)
  const [agreed, setAgreed] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  // A type from another door's list doesn't carry over.
  const v: OrgAnswers = {
    ...EMPTY_ORG_ANSWERS,
    ...answers,
    org_type: answers.org_type && isOrgTypeAllowed(source, answers.org_type) ? answers.org_type : '',
  }
  const set = <K extends keyof OrgAnswers>(k: K, value: OrgAnswers[K]) =>
    setAnswers((a) => ({ ...a, [k]: value }))
  const ctx = { v, set, door: source }

  const email = account.email.trim().toLowerCase()
  const freeEmail = EMAIL_RE.test(email) && isFreeEmail(email)
  const preAccount = {
    org_type: v.org_type,
    org_type_other: v.org_type === 'other' ? v.org_type_other.trim() : '',
    facility_name: v.facility_name.trim(),
  }

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
          role: 'facility',
          signup_path: source,
          email,
          password: account.password,
          first_name: account.first_name.trim(),
          last_name: account.last_name.trim(),
          org_type: preAccount.org_type,
          org_type_other: preAccount.org_type_other || undefined,
          facility_name: preAccount.facility_name,
          accepted_terms: true,
          terms_version: TERMS_VERSION,
          org_terms_version: ORG_AGREEMENT_VERSION,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) return signupErrorResult(res.status, body.error || 'Could not create account')
      trackSignupCompleted(source)
      clear()
      finish(!!body.needsEmailConfirmation)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error — please try again' }
    }
  }

  /** After the account exists: the check-email screen, or on to onboarding. */
  function finish(needsConfirmation: boolean) {
    if (needsConfirmation) {
      setConfirmEmail(email)
      return
    }
    router.push(ONBOARDING_PATH)
    router.refresh()
  }

  async function continueWithGoogle() {
    if (googleLoading) return
    setGoogleLoading(true)
    const next = `${GOOGLE_ACCOUNT_PATH}?source=${source}`
    if (isDemoMode()) {
      router.push(next)
      return
    }
    writeOrgSignupSourceCookie(source, preAccount)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Google accounts are created as professionals; the account step
        // turns a brand-new one into an organization, saves screens 1–2 and
        // records the Terms + Organization Terms consent.
        redirectTo: googleRedirectTo(next),
      },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  const aq = ORG_QUESTIONS.account
  const account3 = accountScreens({
    id: aq.id,
    title: aq.text,
    sub: 'Free to join.',
    account,
    setAccount: (patch) => setAccount((a) => ({ ...a, ...patch })),
    emailLabel: 'Work email',
    emailPlaceholder: 'you@yourorganization.com',
    emailHint: freeEmail ? 'Tip: an address at your organization’s domain helps us verify you faster.' : aq.helper,
    onGoogle: () => void continueWithGoogle(),
    googleLoading,
    consentValid: agreed,
    renderConsent: () => <OrgTermsConsent checked={agreed} onChange={setAgreed} />,
    create: createAccount,
  })

  const start = !v.org_type || (v.org_type === 'other' && !v.org_type_other.trim()) ? 0 : !v.facility_name.trim() ? 1 : 2

  return {
    hydrated,
    flowId: 'organization',
    screens: [typeScreen(ctx), nameScreen(ctx), ...account3],
    resumeIndex: start,
    done: confirmEmail ? (
      <div className="mx-auto w-full max-w-xl">
        <CheckEmailStep email={confirmEmail} onStartOver={() => setConfirmEmail(null)} />
      </div>
    ) : null,
  }
}
