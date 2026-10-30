'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MESSAGE_SELECT, type MessageItem } from '@/lib/messaging/types'

const POLL_MS = 4000

/**
 * Deliver new messages in a conversation as they arrive.
 *
 * Realtime is the fast path, but it can silently miss events (the socket may
 * join before the session token is attached, or drop and reconnect), which
 * made sent messages look like they never went through. So we also poll for
 * anything newer than the latest message we have while the tab is visible.
 * `onMessage` must ignore duplicates.
 */
export function useLiveMessages(
  conversationId: string | null,
  latestAt: string | null,
  onMessage: (m: MessageItem) => void,
  enabled = true
) {
  const latestRef = useRef(latestAt)
  const onMessageRef = useRef(onMessage)
  useEffect(() => {
    latestRef.current = latestAt
    onMessageRef.current = onMessage
  })

  useEffect(() => {
    if (!enabled || !conversationId) return
    const supabase = createClient()
    let cancelled = false

    const channel = supabase.channel(`messages-${conversationId}`)
    // Attach the signed-in user's token before joining so RLS lets events through.
    supabase.realtime
      .setAuth()
      .catch(() => {})
      .finally(() => {
        if (cancelled) return
        channel
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => onMessageRef.current(payload.new as MessageItem)
          )
          .subscribe()
      })

    let polling = false
    async function poll() {
      if (polling || document.visibilityState !== 'visible') return
      polling = true
      try {
        let q = supabase
          .from('messages')
          .select(MESSAGE_SELECT)
          .eq('conversation_id', conversationId!)
          .order('created_at', { ascending: true })
          .limit(100)
        if (latestRef.current) q = q.gt('created_at', latestRef.current)
        const { data } = await q
        if (!cancelled) for (const m of (data ?? []) as unknown as MessageItem[]) onMessageRef.current(m)
      } finally {
        polling = false
      }
    }
    const id = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', poll)
      supabase.removeChannel(channel)
    }
  }, [conversationId, enabled])
}
