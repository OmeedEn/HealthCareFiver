'use client'

import { useState, useTransition } from 'react'
import { CircleCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TextAreaField } from '@/app/onboarding/professional/ui'
import { CLIENT_NOTE_MAX } from '@/lib/onboarding/client-interests'
import { requestCareHelp } from './actions'

/**
 * "Request help finding someone": what they need is already known from
 * their answers, so the only field is an optional short note.
 */
export function RequestHelpForm({ alreadyRequested }: { alreadyRequested: boolean }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [sent, setSent] = useState(alreadyRequested)
  const [pending, startTransition] = useTransition()

  if (sent) {
    return (
      <div role="status" className="flex items-start gap-2.5 rounded-lg border border-[#c9cdfb] bg-[#eceefe] p-4 text-sm text-[#1a1a17]">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-[#2330c8]" aria-hidden />
        <p>
          <span className="font-semibold">We&apos;ve got your request.</span> Our team will look for someone who
          fits and email you.
        </p>
      </div>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(undefined)
        startTransition(async () => {
          const res = await requestCareHelp(note)
          if (res.ok) setSent(true)
          else setError(res.error)
        })
      }}
    >
      <TextAreaField
        id="care-request-note"
        label="Anything else we should know?"
        optional
        value={note}
        onChange={setNote}
        maxLength={CLIENT_NOTE_MAX}
        counter
        rows={3}
        placeholder="e.g. evenings work best, Spanish-speaking"
        error={error}
      />
      <p className="text-xs text-[#5f5d57]">Please don&apos;t include medical details.</p>
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full bg-[#2f3cf5] text-sm font-semibold text-white hover:bg-[#2330c8] sm:w-auto sm:px-6"
      >
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Request help finding someone
      </Button>
    </form>
  )
}
