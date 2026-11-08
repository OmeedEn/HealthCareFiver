'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { markCareRequest } from './actions'

export function CareRequestActions({ id, status }: { id: string; status: 'open' | 'contacted' | 'closed' }) {
  const [pending, startTransition] = useTransition()

  function mark(next: 'contacted' | 'closed') {
    startTransition(async () => {
      const res = await markCareRequest(id, next)
      if (!res.ok) toast.error(res.error ?? 'Failed')
      else toast.success(next === 'contacted' ? 'Marked contacted.' : 'Closed.')
    })
  }

  if (status === 'closed') return null
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'open' && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => mark('contacted')}>
          Mark contacted
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => mark('closed')}>
        Mark closed
      </Button>
    </div>
  )
}
