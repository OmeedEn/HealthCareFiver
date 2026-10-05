'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { respondToInquiry, setAcceptsInquiries } from './actions'

export function InquiryResponseButtons({ id }: { id: string }) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  async function respond(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline')
    const res = await respondToInquiry(id, accept)
    setBusy(null)
    if (!res.ok) toast.error(res.error ?? 'Something went wrong')
    else toast.success(accept ? 'Accepted — conversation started' : 'Declined')
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={busy !== null} onClick={() => respond(true)} className="bg-[#1dbf73] text-white hover:bg-[#19a463]">
        {busy === 'accept' ? 'Accepting…' : 'Accept'}
      </Button>
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => respond(false)}>
        {busy === 'decline' ? 'Declining…' : 'Decline'}
      </Button>
    </div>
  )
}

export function InquiryToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div>
          <p className="font-semibold text-[#404145]">Accept inquiries from organizations</p>
          <p className="text-sm text-[#62646a]">Turn this off and organizations can’t send you inquiries or invitations.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            aria-label="Accept inquiries from organizations"
            checked={on}
            disabled={busy}
            onChange={async (e) => {
              const next = e.target.checked
              setBusy(true)
              const res = await setAcceptsInquiries(next)
              setBusy(false)
              if (!res.ok) toast.error(res.error ?? 'Could not save')
              else setOn(next)
            }}
            className="size-5 accent-[#1dbf73]"
          />
          {on ? 'On' : 'Off'}
        </label>
      </CardContent>
    </Card>
  )
}
