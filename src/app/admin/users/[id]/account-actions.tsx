'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { setAccountActive } from './actions'

export function AccountActions({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function run() {
    startTransition(async () => {
      try {
        const res = await setAccountActive(userId, !isActive)
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success(isActive ? 'Account suspended — sign-in blocked' : 'Account reactivated')
        setOpen(false)
      } catch {
        toast.error('Action failed')
      }
    })
  }

  return (
    <>
      <Button size="sm" disabled={pending} variant={isActive ? 'destructive' : 'outline'} onClick={() => setOpen(true)}>
        {isActive ? 'Suspend account' : 'Reactivate account'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="font-sans">
          <DialogHeader>
            <DialogTitle className="text-[#404145]">
              {isActive ? 'Suspend this account?' : 'Reactivate this account?'}
            </DialogTitle>
            <DialogDescription className="text-[#62646a]">
              {isActive
                ? 'This blocks sign-in until you reactivate the account. A session that’s already open ends when its token expires (within about an hour). Verification status and listings are not changed, and no email is sent.'
                : 'They can sign in again. Their verification status is not changed.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant={isActive ? 'destructive' : 'default'} disabled={pending} onClick={run}>
              {isActive ? 'Suspend and block sign-in' : 'Reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
