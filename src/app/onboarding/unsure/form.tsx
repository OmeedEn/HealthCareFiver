'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TermsConsent } from '@/components/auth/signup-shared'
import {
  EMPTY_UNSURE_ANSWERS,
  UnsureAnswersFields,
  unsureAnswersComplete,
  unsureAnswersPayload,
  type UnsureAnswersDraft,
} from '@/components/auth/unsure-answers'
import { formatUsPhoneInput, normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { trackEvent } from '@/lib/analytics/posthog'
import { SIGNUP_EVENTS } from '@/lib/onboarding/signup-path'
import { isDemoMode } from '@/lib/demo/data'
import { finishUnsureAccount } from './actions'

export function UnsureAccountForm({
  prefill,
  needsTerms,
  termsVersion,
}: {
  prefill: { firstName: string; lastName: string }
  needsTerms: boolean
  termsVersion: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState(prefill.firstName)
  const [lastName, setLastName] = useState(prefill.lastName)
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [answers, setAnswers] = useState<UnsureAnswersDraft>(EMPTY_UNSURE_ANSWERS)

  useEffect(() => {
    // Google path: step 1 happened on /signup/unsure; this is step 2.
    trackEvent(SIGNUP_EVENTS.stepViewed, { flow: 'unsure', step: 2 })
  }, [])

  const phoneOk = normalizeUsPhone(phone) !== null
  const phoneInvalid = phoneTouched && phone.trim() !== '' && !phoneOk
  const canSubmit =
    !!firstName.trim() &&
    !!lastName.trim() &&
    phoneOk &&
    (!needsTerms || accepted) &&
    unsureAnswersComplete(answers)

  function submit() {
    if (!canSubmit || pending) return
    setError(null)
    if (isDemoMode()) {
      router.push('/dashboard')
      return
    }
    startTransition(async () => {
      const result = await finishUnsureAccount({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone,
        ...(needsTerms ? { accepted_terms: accepted, terms_version: termsVersion } : {}),
        answers: unsureAnswersPayload(answers),
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      trackEvent(SIGNUP_EVENTS.completed, { signup_path: 'UNSURE' })
      router.push('/dashboard')
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <h1 className="text-2xl font-bold tracking-tight text-[#404145]">Tell us about you</h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        A few details so our team can place you in the right category.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="first_name" className="text-sm font-semibold text-[#404145]">First name</Label>
          <Input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_name" className="text-sm font-semibold text-[#404145]">Last name</Label>
          <Input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className="h-11" />
        </div>
      </div>

      <div className="mt-3 mb-6 space-y-1.5">
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

      <UnsureAnswersFields value={answers} onChange={setAnswers} />

      {needsTerms && <TermsConsent checked={accepted} onChange={setAccepted} />}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit || pending}
        className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
      >
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Finish
      </Button>
    </form>
  )
}
