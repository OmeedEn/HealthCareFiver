'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { openStripeDashboard } from './actions'

export function StripeDashboardButton() {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const res = await openStripeDashboard()
        if (res.ok) {
          window.location.href = res.url
          return
        }
        toast.error(res.error)
        setBusy(false)
      }}
    >
      {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ExternalLink className="mr-2 size-4" />}
      Open Stripe dashboard
    </Button>
  )
}
