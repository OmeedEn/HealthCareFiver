'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SIGNUP_PATH_SHORT_LABELS, type SignupPath } from '@/lib/onboarding/signup-path'
import { changeAccountCategory } from './actions'

const OPTIONS: Exclude<SignupPath, 'UNSURE'>[] = ['INDEPENDENT', 'PRACTICE', 'COMPANY', 'HIRING', 'CLIENT']

const WHAT_HAPPENS: Record<(typeof OPTIONS)[number], string> = {
  INDEPENDENT:
    'Account type becomes professional. Their professional profile starts at the beginning of onboarding with verification not submitted.',
  PRACTICE:
    'Account type becomes organization. Organization onboarding reopens (not submitted) and verification goes back to pending review.',
  COMPANY:
    'Account type becomes organization. Organization onboarding reopens (not submitted) and verification goes back to pending review.',
  HIRING:
    'Account type becomes organization. Organization onboarding reopens (not submitted) and verification goes back to pending review.',
  CLIENT: 'Account type becomes client. Existing profile data is kept.',
}

export function CategoryControl({
  userId,
  currentPath,
}: {
  userId: string
  currentPath: string | null
}) {
  const [target, setTarget] = useState<(typeof OPTIONS)[number] | ''>('')
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [pending, startTransition] = useTransition()

  function apply() {
    if (!target) return
    const path = target
    startTransition(async () => {
      const res = await changeAccountCategory(userId, path, { note, notify })
      if (!res.ok) {
        toast.error(res.error ?? 'Failed')
        return
      }
      const email =
        res.email === 'sent' ? ' Email sent.' : res.email === 'failed' ? ' Email failed (logged).' : ''
      toast.success(`Category changed to ${SIGNUP_PATH_SHORT_LABELS[path]}.${email}`)
      setConfirming(false)
      setTarget('')
      setNote('')
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value as (typeof OPTIONS)[number] | '')
            setConfirming(false)
          }}
          disabled={pending}
          aria-label="New category"
          className="h-9 rounded-md border border-[#e4e5e7] bg-white px-2 text-sm outline-none focus:border-[#1dbf73]"
        >
          <option value="">Change category to…</option>
          {OPTIONS.map((o) => (
            <option key={o} value={o}>
              {SIGNUP_PATH_SHORT_LABELS[o]}
            </option>
          ))}
        </select>
        {!confirming && (
          <Button size="sm" variant="outline" disabled={!target || pending} onClick={() => setConfirming(true)}>
            Change category
          </Button>
        )}
      </div>

      {confirming && target && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-[#404145]">
          <p>
            Change from <strong>{currentPath && currentPath in SIGNUP_PATH_SHORT_LABELS ? SIGNUP_PATH_SHORT_LABELS[currentPath as SignupPath] : 'no category'}</strong> to{' '}
            <strong>{SIGNUP_PATH_SHORT_LABELS[target]}</strong>? {WHAT_HAPPENS[target]}
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Optional note to the person (included in the email)"
            disabled={pending}
            className="bg-white"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={pending} />
            Email them the Finish setup link
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} className="bg-[#1dbf73] text-white hover:bg-[#19a463]" onClick={apply}>
              {pending ? 'Saving…' : 'Confirm change'}
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
