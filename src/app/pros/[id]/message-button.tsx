'use client'

import { useActionState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { startConversation, type StartConversationState } from './actions'

const BUTTON =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1dbf73] px-4 text-sm font-semibold text-white transition hover:bg-[#19a463] disabled:opacity-60'

export function MessageButton({ proId, firstName }: { proId: string; firstName: string }) {
  const [state, action, pending] = useActionState<StartConversationState, FormData>(
    startConversation.bind(null, proId),
    {}
  )
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <button type="submit" className={BUTTON} disabled={pending}>
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
