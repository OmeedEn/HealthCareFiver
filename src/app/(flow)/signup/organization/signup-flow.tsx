'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ORG_AGREEMENT_VERSION, TERMS_VERSION } from '@/lib/legal'
import { isFreeEmail } from '@/lib/onboarding/organization'
import { ORG_QUESTIONS } from '@/lib/onboarding/questions/organization'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'
import { writeOrgSignupSourceCookie } from '@/lib/onboarding/org-signup-source'
import { usePreAccountAnswers } from '@/lib/onboarding/pre-account'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'
import { CheckEmailStep, type SignupResponse } from '@/components/auth/signup-shared'
import { OrgTermsConsent } from '@/components/org/org-terms-consent'
import { TextField } from '@/app/onboarding/professional/ui'
import { EMPTY_ORG_ANSWERS, nameScreen, typeScreen, type OrgAnswers } from '@/app/onboarding/organization/org-screens'
import { isOrgTypeAllowed } from '@/app/onboarding/organization/shared'

// Organization signup, screens 1–3 (Single-Question Onboarding spec):
// organization type and name are held in this browser tab only
// (sessionStorage) until the account screen sends them with the signup
// request, or the Google path carries them in a short-lived cookie.
// Screens 4–8 continue at /onboarding/organization.

const ONBOARDING_PATH = '/onboarding/organization'
const GOOGLE_ACCOUNT_PATH = '/onboarding/organization/account'

type PreAccount = Pick<OrgAnswers, 'org_type' | 'org_type_other' | 'facility_name'>

export function OrganizationSignupFlow({ source }: { source: OrgSignupPath }) {
  const router = useRouter()
  const [answers, setAnswers, { hydrated, clear }] = usePreAccountAnswers<PreAccount>(`organization:${source}`, {
    org_type: '',
    org_type_other: '',
    facility_name: '',
  })
  const [account, setAccount] = useState({ first: '', last: '', email: '', password: '', agreed: false })
  const [googleLoading, setGoogleLoading] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const after = useRef<'confirm' | 'onboarding'>('onboarding')

  if (confirmEmail) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <CheckEmailStep email={confirmEmail} onStartOver={() => setConfirmEmail(null)} />
      </div>
    )
  }
  // Wait for stored answers so the flow resumes on the right screen.
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />

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
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  const freeEmail = emailValid && isFreeEmail(email)
  const preAccount = {
    org_type: v.org_type,
    org_type_other: v.org_type === 'other' ? v.org_type_other.trim() : '',
    facility_name: v.facility_name.trim(),
  }

  async function createAccount() {
    if (isDemoMode()) return { ok: true as const }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'facility',
          signup_path: source,
          email,
          password: account.password,
          first_name: account.first.trim(),
          last_name: account.last.trim(),
          org_type: preAccount.org_type,
          org_type_other: preAccount.org_type_other || undefined,
          facility_name: preAccount.facility_name,
          accepted_terms: true,
          terms_version: TERMS_VERSION,
          org_terms_version: ORG_AGREEMENT_VERSION,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false as const, error: body.error || 'Could not create account' }
      trackSignupCompleted(source)
      clear()
      after.current = body.needsEmailConfirmation ? 'confirm' : 'onboarding'
      return { ok: true as const }
    } catch {
      return { ok: false as const, error: 'Network error — please try again' }
    }
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
    const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Google accounts are created as professionals; the account step
        // turns a brand-new one into an organization, saves screens 1–2 and
        // records the Terms + Organization Terms consent.
        redirectTo: `${origin}/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  const aq = ORG_QUESTIONS.account
  const accountScreen: Screen = {
    id: aq.id,
    title: aq.text,
    sub: 'Free to join.',
    continueLabel: aq.continueLabel,
    fields: ['first_name', 'last_name', 'email', 'password'],
    canContinue: () =>
      !!account.first.trim() && !!account.last.trim() && emailValid && account.password.length >= 8 && account.agreed,
    save: createAccount,
    render: () => (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={continueWithGoogle}
          disabled={googleLoading}
          className="h-12 w-full text-base font-semibold"
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
          <TextField id="first_name" label="First name" value={account.first} onChange={(x) => setAccount((a) => ({ ...a, first: x }))} autoComplete="given-name" maxLength={100} />
          <TextField id="last_name" label="Last name" value={account.last} onChange={(x) => setAccount((a) => ({ ...a, last: x }))} autoComplete="family-name" maxLength={100} />
        </div>
        <TextField
          id="email"
          label="Work email"
          type="email"
          inputMode="email"
          value={account.email}
          onChange={(x) => setAccount((a) => ({ ...a, email: x }))}
          autoComplete="email"
          placeholder="you@yourorganization.com"
          hint={freeEmail ? 'Tip: an address at your organization’s domain helps us verify you faster.' : aq.helper}
          maxLength={254}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          value={account.password}
          onChange={(x) => setAccount((a) => ({ ...a, password: x }))}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          maxLength={200}
        />
        <OrgTermsConsent checked={account.agreed} onChange={(x) => setAccount((a) => ({ ...a, agreed: x }))} />
        <p className="text-center text-sm text-[#62646a]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#1dbf73] hover:underline">
            Sign in
          </Link>
        </p>
      </>
    ),
  }

  const screens: Screen[] = [typeScreen(ctx), nameScreen(ctx), accountScreen]
  const start = !v.org_type || (v.org_type === 'other' && !v.org_type_other.trim()) ? 0 : !v.facility_name.trim() ? 1 : 2

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={start}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="organization"
      // HIRING came from /signup/looking; PRACTICE and COMPANY from /signup/offer.
      onExit={() => router.push(source === 'HIRING' ? '/signup/looking' : '/signup/offer')}
      onFinish={() => {
        if (after.current === 'confirm') {
          setConfirmEmail(email)
          return
        }
        router.push(ONBOARDING_PATH)
        router.refresh()
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
