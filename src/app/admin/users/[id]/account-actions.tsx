'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { setAccountActive, setAccountVerified } from './actions'

export function AccountActions({
  userId,
  isActive,
  isVerified,
}: {
  userId: string
  isActive: boolean
  isVerified: boolean
}) {
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await fn()
        toast.success(success)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Action failed')
      }
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        className={isVerified ? '' : 'bg-[#1dbf73] text-white hover:bg-[#19a463]'}
        variant={isVerified ? 'outline' : 'default'}
        onClick={() =>
          run(
            () => setAccountVerified(userId, !isVerified),
            isVerified ? 'Marked unverified' : 'Marked verified'
          )
        }
      >
        {isVerified ? 'Remove verified flag' : 'Mark account verified'}
      </Button>
      <Button
        size="sm"
        disabled={pending}
        variant={isActive ? 'destructive' : 'outline'}
        onClick={() =>
          run(
            () => setAccountActive(userId, !isActive),
            isActive ? 'Account suspended' : 'Account reactivated'
          )
        }
      >
        {isActive ? 'Suspend account' : 'Reactivate account'}
      </Button>
    </div>
  )
}
