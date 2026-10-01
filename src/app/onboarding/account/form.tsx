'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TermsConsent } from '@/components/auth/signup-shared'
import { formatUsPhoneInput, normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { finishAccount, type FinishAccountState } from './actions'
import type { AccountGaps, AccountPrefill } from '@/lib/onboarding/account-gaps'

export function FinishAccountForm({
  gaps,
  prefill,
  termsVersion,
}: {
  gaps: AccountGaps
  prefill: AccountPrefill
  termsVersion: string
}) {
  const [state, formAction, pending] = useActionState<FinishAccountState, FormData>(
    finishAccount,
    null
  )
  const [firstName, setFirstName] = useState(prefill.firstName)
  const [lastName, setLastName] = useState(prefill.lastName)
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const phoneOk = !gaps.phone || normalizeUsPhone(phone) !== null
  const nameOk = !gaps.name || (firstName.trim() !== '' && lastName.trim() !== '')
  const termsOk = !gaps.terms || accepted
  const canSubmit = phoneOk && nameOk && termsOk
  const phoneInvalid = gaps.phone && phoneTouched && phone.trim() !== '' && !phoneOk

  return (
    <form action={formAction}>
      <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
        Finish creating your account
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        Just a couple of details before you set up your professional profile.
      </p>

      {gaps.name && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="first_name" className="text-sm font-semibold text-[#404145]">First name</Label>
            <Input id="first_name" name="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name" className="text-sm font-semibold text-[#404145]">Last name</Label>
            <Input id="last_name" name="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className="h-11" />
          </div>
        </div>
      )}

      {gaps.phone && (
        <div className={`${gaps.name ? 'mt-3' : 'mt-6'} space-y-1.5`}>
          <Label htmlFor="phone" className="text-sm font-semibold text-[#404145]">Phone number</Label>
          <Input
            id="phone"
            name="phone"
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
      )}

      {gaps.terms && (
        <>
          <input type="hidden" name="terms_version" value={termsVersion} />
          {/* TermsConsent is controlled; mirror it into the form data. */}
          {accepted && <input type="hidden" name="accepted_terms" value="on" />}
          <TermsConsent checked={accepted} onChange={setAccepted} />
        </>
      )}

      {state?.error && (
        <p role="alert" className="mt-4 text-sm text-red-600">{state.error}</p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit || pending}
        className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
      >
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Continue
      </Button>
    </form>
  )
}
