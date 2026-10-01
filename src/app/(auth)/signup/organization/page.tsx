'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { TERMS_VERSION } from '@/lib/legal'
import { formatUsPhoneInput, normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { isFreeEmail } from '@/lib/onboarding/organization'
import {
  CheckEmailStep,
  TermsConsent,
  type SignupResponse,
} from '@/components/auth/signup-shared'
import { Loader2, ArrowLeft } from 'lucide-react'

// Step 1 of organization onboarding: create the account. Organization
// details, verification and intents (steps 2–4) happen in the wizard at
// /onboarding/organization, which saves as you go.

const WIZARD_PATH = '/onboarding/organization'
const GOOGLE_ACCOUNT_PATH = '/onboarding/organization/account'

export default function OrganizationSignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const normalizedPhone = normalizeUsPhone(phone)
  const trimmedEmail = email.trim().toLowerCase()
  const freeEmail = trimmedEmail.includes('@') && isFreeEmail(trimmedEmail)
  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    title.trim() &&
    trimmedEmail &&
    password.length >= 8 &&
    password === confirmPassword &&
    normalizedPhone !== null &&
    acceptedTerms

  async function submitAccount() {
    if (!canSubmit || loading) return
    setLoading(true)
    if (isDemoMode()) {
      router.push(WIZARD_PATH)
      return
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'facility',
          email: trimmedEmail,
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          title: title.trim(),
          phone: normalizedPhone,
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
      if (body.needsEmailConfirmation) {
        setNeedsConfirmation(true)
        setLoading(false)
        return
      }
      router.push(WIZARD_PATH)
      router.refresh()
    } catch {
      toast.error('Network error — please try again')
      setLoading(false)
    }
  }

  async function continueWithGoogle() {
    if (googleLoading) return
    setGoogleLoading(true)
    if (isDemoMode()) {
      router.push(GOOGLE_ACCOUNT_PATH)
      return
    }
    const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Google accounts are created as professionals; the account step
        // turns a brand-new one into an organization and collects title,
        // phone and Terms consent.
        redirectTo: `${origin}/callback?next=${GOOGLE_ACCOUNT_PATH}`,
      },
    })
    if (error) {
      toast.error('Could not start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  function startOver() {
    setNeedsConfirmation(false)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setAcceptedTerms(false)
  }

  if (needsConfirmation) {
    return <CheckEmailStep email={trimmedEmail} onStartOver={startOver} />
  }

  const phoneInvalid = phoneTouched && phone.trim() !== '' && normalizedPhone === null

  return (
    <div>
      <Link
        href="/signup"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1dbf73]">
          Step 1 of 5 · Organization
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#404145]">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-[#62646a]">Free to join. Takes about 5 minutes.</p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={continueWithGoogle}
        disabled={googleLoading || loading}
        className="mt-6 h-11 w-full text-sm font-semibold"
      >
        {googleLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Button>
      <p className="mt-2 text-center text-xs text-[#62646a]">
        Use your work Google account. You&apos;ll add your title and phone number and agree to our
        Terms of Service and Privacy Policy on the next screen.
      </p>

      <div className="my-6 flex items-center gap-3 text-xs text-[#95979d]">
        <div className="h-px flex-1 bg-[#e4e5e7]" />
        or sign up with email
        <div className="h-px flex-1 bg-[#e4e5e7]" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitAccount()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" id="fn" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Field label="Last name" id="ln" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <div className="mt-3">
          <Field
            label="Your role or title at the organization"
            id="title"
            value={title}
            onChange={setTitle}
            autoComplete="organization-title"
            placeholder="e.g. Director of Nursing"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          <Field
            label="Work email"
            id="email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="you@yourorganization.com"
          />
          {freeEmail && (
            <p className="text-xs text-[#b8860b]">
              Tip: use an email at your organization&apos;s domain if you have one. It helps us verify
              you faster.
            </p>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Password" id="pw" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="Min 8 characters" />
          <Field label="Confirm password" id="pw2" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Repeat password" />
        </div>
        {confirmPassword && password !== confirmPassword && (
          <p className="mt-2 text-xs text-red-600">Passwords don&apos;t match.</p>
        )}
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-semibold text-[#404145]">Phone number</Label>
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
          disabled={!canSubmit || loading || googleLoading}
          className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#62646a]">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[#1dbf73] hover:underline">
          Sign in
        </Link>
      </p>
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
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="h-11" />
    </div>
  )
}
