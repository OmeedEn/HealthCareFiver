'use client'

import { useActionState, useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  acceptContractorAgreement,
  type AcceptAgreementState,
} from './actions'

const INITIAL_STATE: AcceptAgreementState = { status: 'idle' }

export function AgreementForm() {
  const [state, formAction, pending] = useActionState(
    acceptContractorAgreement,
    INITIAL_STATE
  )
  const [checked, setChecked] = useState(false)

  // The page re-renders with the accepted state after revalidation; this
  // covers the gap (and demo mode, where nothing is persisted).
  if (state.status === 'success') {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-[#0f8f56]">
        <CheckCircle2 className="h-4 w-4" />
        Agreement accepted
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="flex items-start gap-3 rounded-lg border border-[#e4e5e7] bg-[#fafafa] p-3 text-sm text-[#404145]">
        <input
          type="checkbox"
          name="agree"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-input accent-[#1dbf73]"
          required
        />
        <span>I agree to the Independent Contractor and Platform Agreement</span>
      </label>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}

      <Button
        type="submit"
        disabled={!checked || pending}
        className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Accept and continue'
        )}
      </Button>
    </form>
  )
}
