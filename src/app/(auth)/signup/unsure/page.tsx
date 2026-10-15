'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TERMS_VERSION } from '@/lib/legal'
import { formatUsPhoneInput, normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { trackEvent } from '@/lib/analytics/posthog'
import { SIGNUP_EVENTS } from '@/lib/onboarding/signup-path'
import { UNSURE_GOOGLE_ACCOUNT_PATH } from '@/lib/onboarding/unsure'
import {
  CheckEmailStep,
  TermsConsent,
  type SignupResponse,
} from '@/components/auth/signup-shared'
import {
  EMPTY_UNSURE_ANSWERS,
  UnsureAnswersFields,
  unsureAnswersComplete,
  unsureAnswersPayload,
  type UnsureAnswersDraft,
} from '@/components/auth/unsure-answers'

type Step = 1 | 2 | 'check-email'

/**
 * "Not sure" signup (Signup Routing Update). Step 1 creates the account
 * details, step 2 asks a few questions staff use to place the person in the
 * right category. Everything is collected client-side and the account is
 * created in one request, so nothing is lost if the now-signed-in user is
 * bounced off /signup by the proxy.
 *
 * The account is a client (signup_path UNSURE, classification pending): it
 * can browse, save and book, but can't message professionals until placed.
 */
export default function UnsureSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Step 1 — account
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // Step 2 — about you
  const [answers, setAnswers] = useState<UnsureAnswersDraft>(EMPTY_UNSURE_ANSWERS)

  useEffect(() => {
    if (step === 1 || step === 2) {
      trackEvent(SIGNUP_EVENTS.stepViewed, { flow: 'unsure', step })
    }
  }, [step])

  const passwordsMatch = password === confirmPassword
  const phoneOk = normalizeUsPhone(phone) !== null
  const phoneInvalid = phoneTouched && phone.trim() !== '' && !phoneOk
  const canNextStep1 =
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!email.trim() &&
    password.length >= 8 &&
    passwordsMatch &&
    phoneOk &&
    acceptedTerms
  const canSubmit = canNextStep1 && unsureAnswersComplete(answers)

  function startOver() {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setAcceptedTerms(false)
    setStep(1)
  }

  async function handleCreateAccount() {
    if (!canSubmit || loading) return
    setLoading(true)
    if (isDemoMode()) {
      router.push('/dashboard')
      return
    }
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
          phone,
          answers: unsureAnswersPayload(answers),
          accepted_terms: true,
          terms_version: TERMS_VERSION,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || 'Could not create account')
        setLoading(false)
        return
      }
      trackEvent(SIGNUP_EVENTS.completed, { signup_path: 'UNSURE' })
      if (body.needsEmailConfirmation) {
        setStep('check-email')
        setLoading(false)
        return
      }
      // Signed in: straight to the dashboard (the proxy runs the MFA gate
      // first), which shows the "we're reviewing your answers" banner.
      router.push('/dashboard')
    } catch {
      toast.error('Network error — please try again')
      setLoading(false)
    }
  }

  async function continueWithGoogle() {
    if (googleLoading) return
    setGoogleLoading(true)
    if (isDemoMode()) {
      router.push(UNSURE_GOOGLE_ACCOUNT_PATH)
      return
    }
    const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Google accounts are created as professionals; /onboarding/unsure
        // turns a brand-new one into a Not sure (client) account and asks
        // the step 2 questions there.
        redirectTo: `${origin}/callback?next=${UNSURE_GOOGLE_ACCOUNT_PATH}`,
      },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  if (step === 'check-email') {
    return <CheckEmailStep email={email.trim().toLowerCase()} onStartOver={startOver} />
  }

  return (
    <div>
      {step === 1 ? (
        <Link
          href="/signup/offer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setStep(1)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
      )}
      <ProgressBar step={step} totalSteps={2} />

      {step === 1 && (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (canNextStep1) setStep(2)
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            Not sure where you fit? That&apos;s fine — answer a few questions
            next and our team will place you in the right category.
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={continueWithGoogle}
            disabled={googleLoading}
            className="mt-6 h-11 w-full text-sm font-semibold"
          >
            {googleLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>
          <p className="mt-2 text-center text-xs text-[#62646a]">
            With Google, you&apos;ll add your phone number, agree to our Terms
            of Service and Privacy Policy, and answer the next questions after
            signing in.
          </p>

          <div className="my-6 flex items-center gap-3 text-xs text-[#95979d]">
            <div className="h-px flex-1 bg-[#e4e5e7]" />
            or sign up with email
            <div className="h-px flex-1 bg-[#e4e5e7]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" id="fn" value={firstName} onChange={setFirstName} autoComplete="given-name" />
            <Field label="Last name" id="ln" value={lastName} onChange={setLastName} autoComplete="family-name" />
          </div>
          <div className="mt-3">
            <Field
              label="Email address"
              id="email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Password"
              id="pw"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Min 8 characters"
            />
            <Field
              label="Confirm password"
              id="pw2"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Repeat password"
            />
          </div>
          {password.length > 0 && password.length < 8 ? (
            <p className="mt-2 text-xs text-[#c0392b]">
              Password must be at least 8 characters ({password.length}/8).
            </p>
          ) : (
            <p className="mt-2 text-xs text-[#62646a]">
              Use at least 8 characters. A longer passphrase is stronger.
            </p>
          )}
          {confirmPassword && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-600">Passwords don&apos;t match.</p>
          )}

          <div className="mt-3 space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-semibold text-[#404145]">
              Phone number
            </Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(formatUsPhoneInput(e.target.value))}
              onBlur={() => setPhoneTouched(true)}
              aria-invalid={phoneInvalid || undefined}
              className="h-11"
            />
            {phoneInvalid && <p className="text-xs text-red-600">{PHONE_ERROR}.</p>}
          </div>

          <TermsConsent checked={acceptedTerms} onChange={setAcceptedTerms} />

          <Button
            type="submit"
            disabled={!canNextStep1 || googleLoading}
            className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
          >
            Continue
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </form>
      )}

      {step === 2 && (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            handleCreateAccount()
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Tell us about you
          </h1>
          <p className="mt-1.5 mb-6 text-sm text-[#62646a]">
            We&apos;ll use this to set up the right kind of account for you.
          </p>

          <UnsureAnswersFields value={answers} onChange={setAnswers} />

          <div className="mt-8 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={loading}
              className="h-11 flex-1"
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || loading}
              className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
            >
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create account
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ────── Inline pieces (same look as /signup/client) ────── */

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

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-xs font-medium text-[#62646a]">
        <span>
          Step {step} of {totalSteps}
        </span>
        <span>{Math.round((step / totalSteps) * 100)}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e5e7]">
        <div
          className="h-full rounded-full bg-[#1dbf73] transition-all"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  )
}

function Field({
  label,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  label: string
  id: string
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
        className="h-11"
      />
    </div>
  )
}
