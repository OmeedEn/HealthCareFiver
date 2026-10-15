'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TermsConsent } from '@/components/auth/signup-shared'
import { finishClientAccount, type ClientAccountState } from './actions'

export function ClientAccountForm({
  prefill,
  needsTerms,
  termsVersion,
}: {
  prefill: { firstName: string; lastName: string }
  needsTerms: boolean
  termsVersion: string
}) {
  const [state, formAction, pending] = useActionState<ClientAccountState, FormData>(finishClientAccount, null)
  const [firstName, setFirstName] = useState(prefill.firstName)
  const [lastName, setLastName] = useState(prefill.lastName)
  const [accepted, setAccepted] = useState(false)

  const canSubmit = firstName.trim() && lastName.trim() && (!needsTerms || accepted)

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#e4e5e7] bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-[#404145]">Finish creating your account</h1>
      <p className="mt-1.5 text-sm text-[#62646a]">Confirm your name and you&apos;re all set.</p>

      <form action={formAction} className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="first_name" label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Field id="last_name" label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>

        {needsTerms && (
          <>
            <TermsConsent checked={accepted} onChange={setAccepted} />
            {accepted && <input type="hidden" name="accepted_terms" value="on" />}
            <input type="hidden" name="terms_version" value={termsVersion} />
          </>
        )}

        {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}

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
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
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
        className="h-11"
      />
    </div>
  )
}
