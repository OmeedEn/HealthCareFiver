'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { OrgActionResult } from '../actions'

/** A <form> for the org review actions: errors show as a toast, not a crash. */
export function ActionForm({
  action,
  success,
  className,
  resetOnSuccess = false,
  children,
}: {
  action: (formData: FormData) => Promise<OrgActionResult>
  success: string
  className?: string
  resetOnSuccess?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const ref = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const res = await action(formData)
        if (res?.error) {
          toast.error(res.error)
          return
        }
        toast.success(success)
        if (resetOnSuccess) ref.current?.reset()
        router.refresh()
      } catch {
        toast.error('Something went wrong. Try again.')
      }
    })
  }

  return (
    <form ref={ref} onSubmit={onSubmit}>
      <fieldset disabled={pending} className={`min-w-0 ${className ?? ''}`}>
        {children}
      </fieldset>
    </form>
  )
}
