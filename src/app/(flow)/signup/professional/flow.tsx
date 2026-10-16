'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { TERMS_VERSION } from '@/lib/legal'
import { CheckEmailStep, TermsConsent, type SignupResponse } from '@/components/auth/signup-shared'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'
import {
  QuestionFlow,
  SINGLE_STEP,
  type ActionResult,
  type Screen,
} from '@/components/onboarding/question-flow'
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

interface AccountFields {
  first_name: string
  last_name: string
  email: string
  password: string
  accepted_terms: boolean
}

const EMPTY_ACCOUNT: AccountFields = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  accepted_terms: false,
}

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ProfessionalSignupFlow() {
  const router = useRouter()
  const [answers, setAnswers, { hydrated, clear }] = usePreAccountAnswers<ProSignupAnswers>(
    PRO_PRE_ACCOUNT_KEY,
    EMPTY_PRO_ANSWERS
  )
  // The account fields (incl. the password) are never written to storage.
  const [account, setAccount] = useState<AccountFields>(EMPTY_ACCOUNT)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)
  const outcome = useRef<'confirm' | 'session' | null>(null)

  const set = (patch: Partial<ProSignupAnswers>) => setAnswers((a) => ({ ...a, ...patch }))
  const setA = (patch: Partial<AccountFields>) => setAccount((a) => ({ ...a, ...patch }))

  const branch = branchOf(answers)
  const pre = identityScreens({ answers, set })

  async function createAccount(): Promise<ActionResult> {
    if (isDemoMode()) {
      outcome.current = 'session'
      return { ok: true }
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'contractor',
          signup_path: 'INDEPENDENT',
          email: account.email.trim().toLowerCase(),
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
      if (!res.ok) return { ok: false, error: body.error || 'Could not create your account.' }
      trackSignupCompleted('INDEPENDENT')
      outcome.current = body.needsEmailConfirmation ? 'confirm' : 'session'
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error. Please try again.' }
    }
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
    const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/callback?next=/onboarding/account` },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  const accountScreen: Screen = {
    id: PRO_Q.account,
    title: PRO_COPY.account,
    sub: PRO_COPY.accountSub,
    // Stands in for screens 5–8 too, so the bar shows how far along they
    // really are rather than "done" at the account screen.
    weight: 1 + postAccountScreenIds(branch).length,
    continueLabel: 'Create account',
    canContinue: () =>
      !!account.first_name.trim() &&
      !!account.last_name.trim() &&
      EMAIL_LIKE.test(account.email.trim()) &&
      account.password.length >= 8 &&
      account.accepted_terms,
    save: createAccount,
    render: () => (
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          onClick={continueWithGoogle}
          disabled={googleLoading}
          className="h-12 w-full text-sm font-semibold"
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
          <Field id="first_name" label="First name" value={account.first_name} onChange={(v) => setA({ first_name: v })} autoComplete="given-name" />
          <Field id="last_name" label="Last name" value={account.last_name} onChange={(v) => setA({ last_name: v })} autoComplete="family-name" />
        </div>
        <Field id="email" label="Email" type="email" value={account.email} onChange={(v) => setA({ email: v })} autoComplete="email" placeholder="you@example.com" />
        <Field id="password" label="Password" type="password" value={account.password} onChange={(v) => setA({ password: v })} autoComplete="new-password" placeholder="At least 8 characters" />
        <TermsConsent checked={account.accepted_terms} onChange={(v) => setA({ accepted_terms: v })} />
        <p className="text-center text-xs text-[#62646a]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#1dbf73] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    ),
  }

  const screens = [...pre, accountScreen]

  // Wait for the stored answers so the flow resumes on the first unanswered
  // screen (QuestionFlow reads initialIndex once, on mount).
  if (!hydrated) return null

  if (checkEmail) {
    return (
      <div className="mx-auto max-w-md">
        <CheckEmailStep
          email={checkEmail}
          onStartOver={() => {
            setCheckEmail(null)
            setAccount(EMPTY_ACCOUNT)
            outcome.current = null
          }}
        />
      </div>
    )
  }

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={firstOpenIdentityScreen(pre)}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="professional"
      onExit={() => router.push('/signup/offer')}
      onFinish={() => {
        // Answers now live on the account; drop the browser copy.
        clear()
        if (outcome.current === 'confirm') {
          setCheckEmail(account.email.trim().toLowerCase())
          return
        }
        router.push('/onboarding/professional')
        router.refresh()
      }}
    />
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-11 bg-white"
      />
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
