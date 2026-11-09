'use client'

import { useActionState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { startConversation, type StartConversationState } from './actions'

const BUTTON =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cbc6ba] bg-white px-5 text-sm font-semibold text-[#1a1a17] transition hover:border-[#2f3cf5] hover:text-[#2330c8] disabled:opacity-60'

export function MessageButton({
  proId,
  firstName,
  className = BUTTON,
}: {
  proId: string
  firstName: string
  className?: string
}) {
  const [state, action, pending] = useActionState<StartConversationState, FormData>(
    startConversation.bind(null, proId),
    {}
  )
  return (
    <form action={action} className="flex flex-col gap-2">
      <button type="submit" className={className} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <MessageSquare className="size-4" aria-hidden="true" />
        )}
        Message {firstName || 'professional'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-[#b42318]">
          {state.error}
        </p>
      )}
    </form>
  )
}
