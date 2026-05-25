'use client'

import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function EventDetailRegisterButton({ title }: { title: string }) {
  function handleRegister() {
    if (isDemoMode()) {
      toast.success(`Successfully registered for "${title}" (demo mode)`)
      return
    }
    toast.info('Redirecting to registration...')
  }

  return (
    <Button
      className="w-full bg-[#1dbf73] text-white hover:bg-[#1dbf73]/90"
      size="lg"
      onClick={handleRegister}
    >
      Register Now
    </Button>
  )
}
