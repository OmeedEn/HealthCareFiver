'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { messageUser } from '@/lib/admin/message-user'

export function MessageUserButton({ userId, demo = false }: { userId: string; demo?: boolean }) {
  const [pending, startTransition] = useTransition()

  function onClick() {
    if (demo) {
      toast.info('Demo mode — messaging is off')
      return
    }
    startTransition(async () => {
      try {
        await messageUser(userId)
      } catch (err) {
        // redirect() throws internally on success; only real failures land here.
        if (err && typeof err === 'object' && 'digest' in err && String(err.digest).startsWith('NEXT_REDIRECT')) throw err
        toast.error(err instanceof Error ? err.message : 'Could not open conversation')
      }
    })
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={onClick}>
      <MessageSquare className="size-4" data-icon="inline-start" />
      Message
    </Button>
  )
}
