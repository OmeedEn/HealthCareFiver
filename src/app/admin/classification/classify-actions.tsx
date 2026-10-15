'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SIGNUP_PATH_SHORT_LABELS, type ClassifyDecision } from '@/lib/onboarding/signup-path'
import { classifySignup } from './actions'

const CHOICES: { decision: ClassifyDecision; label: string }[] = [
  { decision: 'INDEPENDENT', label: `Assign as ${SIGNUP_PATH_SHORT_LABELS.INDEPENDENT}` },
  { decision: 'PRACTICE', label: `Assign as ${SIGNUP_PATH_SHORT_LABELS.PRACTICE}` },
  { decision: 'COMPANY', label: `Assign as ${SIGNUP_PATH_SHORT_LABELS.COMPANY}` },
  { decision: 'CLIENT', label: `Assign as ${SIGNUP_PATH_SHORT_LABELS.CLIENT}` },
  { decision: 'REJECTED', label: 'Reject' },
]

const EMAIL_NOTE: Record<string, string> = {
  sent: 'Email sent.',
  failed: 'Email failed to send (logged) — follow up manually.',
  skipped: 'No email on file, so no email was sent.',
}

export function ClassifyActions({ userId, name }: { userId: string; name: string }) {
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<ClassifyDecision | null>(null)
  const [pending, startTransition] = useTransition()
  const pickedLabel = CHOICES.find((c) => c.decision === picked)?.label

  function confirm() {
    if (!picked) return
    const decision = picked
    startTransition(async () => {
      const res = await classifySignup(userId, decision, note)
      if (!res.ok) {
        toast.error(res.error ?? 'Failed')
        return
      }
      const what = decision === 'REJECTED' ? `Rejected ${name}.` : `${name}: ${pickedLabel?.toLowerCase()}.`
      toast.success(`${what} ${EMAIL_NOTE[res.email ?? 'skipped']}`)
      setPicked(null)
      setNote('')
    })
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Optional note to the applicant (included in their email)"
        disabled={pending}
      />
      {picked ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#e4e5e7] bg-[#f9fafb] p-2 text-sm">
          <span className="text-[#404145]">
            {picked === 'REJECTED' ? `Reject ${name}? They stay a client and get a short email.` : `${pickedLabel} and email ${name} the Finish setup link?`}
          </span>
          <Button
            size="sm"
            disabled={pending}
            variant={picked === 'REJECTED' ? 'destructive' : 'default'}
            className={picked === 'REJECTED' ? '' : 'bg-[#1dbf73] text-white hover:bg-[#19a463]'}
            onClick={confirm}
          >
            {pending ? 'Saving…' : 'Confirm'}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setPicked(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {CHOICES.map((c) => (
            <Button
              key={c.decision}
              size="sm"
              variant={c.decision === 'REJECTED' ? 'destructive' : 'outline'}
              disabled={pending}
              onClick={() => setPicked(c.decision)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
