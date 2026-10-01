'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TermsConsent } from '@/components/auth/signup-shared'
import { formatUsPhoneInput, normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { finishOrgAccount, type OrgAccountState } from './actions'

export function OrgAccountForm({
  prefill,
  needsTerms,
  termsVersion,
}: {
  prefill: { firstName: string; lastName: string; title: string }
  needsTerms: boolean
  termsVersion: string
}) {
  const [state, formAction, pending] = useActionState<OrgAccountState, FormData>(finishOrgAccount, null)
  const [firstName, setFirstName] = useState(prefill.firstName)
  const [lastName, setLastName] = useState(prefill.lastName)
  const [title, setTitle] = useState(prefill.title)
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const normalized = normalizeUsPhone(phone)
  const phoneInvalid = phoneTouched && phone.trim() !== '' && normalized === null
  const canSubmit =
    firstName.trim() && lastName.trim() && title.trim() && normalized !== null && (!needsTerms || accepted)

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#e4e5e7] bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1dbf73]">Step 1 of 5 · Organization</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#404145]">Finish creating your account</h1>
      <p className="mt-1.5 text-sm text-[#62646a]">A few details Google didn&apos;t give us.</p>

      <form action={formAction} className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="first_name" label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Field id="last_name" label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <Field
          id="title"
          label="Your role or title at the organization"
          value={title}
          onChange={setTitle}
          autoComplete="organization-title"
          placeholder="e.g. Director of Nursing"
        />
        <div className="space-y-1.5">
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

        {needsTerms && (
          <>
            <TermsConsent checked={accepted} onChange={setAccepted} />
            {accepted && <input type="hidden" name="accepted_terms" value="on" />}
            <input type="hidden" name="terms_version" value={termsVersion} />
          </>
        )}

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <Button
          type="submit"
          disabled={!canSubmit || pending}
          className="mt-3 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
        >
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue
        </Button>
      </form>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">{label}</Label>
      <Input
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-11"
      />
    </div>
  )
}
