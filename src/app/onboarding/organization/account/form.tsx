'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrgTermsConsent } from '@/components/org/org-terms-consent'
import { ORG_QUESTIONS } from '@/lib/onboarding/questions/organization'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'
import { PRIMARY_BTN, TextField } from '../../professional/ui'
import { finishOrgAccount, type OrgAccountState } from './actions'

/** The account screen, finished after "Continue with Google": name (prefilled) and the one consent checkbox. */
export function OrgAccountForm({
  prefill,
  termsVersion,
  orgTermsVersion,
  source,
}: {
  prefill: { firstName: string; lastName: string }
  termsVersion: string
  orgTermsVersion: string
  source: OrgSignupPath | null
}) {
  const [state, formAction, pending] = useActionState<OrgAccountState, FormData>(finishOrgAccount, null)
  const [firstName, setFirstName] = useState(prefill.firstName)
  const [lastName, setLastName] = useState(prefill.lastName)
  const [accepted, setAccepted] = useState(false)
  const canSubmit = firstName.trim() && lastName.trim() && accepted

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight text-[#404145] sm:text-[2rem] sm:leading-tight">
        {ORG_QUESTIONS.account.text}
      </h1>
      <p className="mt-2 text-base text-[#62646a]">Free to join. Check your name and agree to continue.</p>

      <form action={formAction} className="mt-6 space-y-5">
        {source && <input type="hidden" name="source" value={source} />}
        <input type="hidden" name="terms_version" value={termsVersion} />
        <input type="hidden" name="org_terms_version" value={orgTermsVersion} />
        {accepted && <input type="hidden" name="accepted_terms" value="on" />}
        <div className="grid grid-cols-2 gap-3">
          <NamedField id="first_name" label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <NamedField id="last_name" label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <OrgTermsConsent checked={accepted} onChange={setAccepted} />

        {state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit || pending} className={`${PRIMARY_BTN} h-12 w-full text-base`}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue
        </Button>
      </form>
    </div>
  )
}

/** TextField plus a hidden input so the server action receives the value. */
function NamedField(props: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  return (
    <>
      <TextField {...props} maxLength={100} />
      <input type="hidden" name={props.id} value={props.value} />
    </>
  )
}
