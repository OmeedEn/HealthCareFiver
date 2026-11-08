'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_CONVERSATIONS } from '@/lib/demo/data'

/**
 * Same rule as the /messages list: unread = messages in my conversations,
 * sent by the other side, with no read_at yet.
 */
async function loadUnreadCount(): Promise<number> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0
  const { data: convos } = await supabase
    .from('conversations')
    .select('id')
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
  const ids = (convos ?? []).map((c) => c.id as string)
  if (ids.length === 0) return 0
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', ids)
    .is('read_at', null)
    .neq('sender_id', user.id)
  return count ?? 0
}

export function MessagesLink() {
  const pathname = usePathname()
  const [unread, setUnread] = useState(() =>
    isDemoMode() ? DEMO_CONVERSATIONS.reduce((n, c) => n + (c.unread_count ?? 0), 0) : 0
  )

  // Refresh on navigation so opening a thread clears the badge.
  useEffect(() => {
    if (isDemoMode()) return
    let cancelled = false
    loadUnreadCount()
      .then((n) => {
        if (!cancelled) setUnread(n)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname])

  const active = pathname === '/messages' || pathname.startsWith('/messages/')

  return (
    <Link
      href="/messages"
      aria-label={`Messages${unread > 0 ? ` (${unread} unread)` : ''}`}
      aria-current={active ? 'page' : undefined}
      className={`relative inline-flex size-9 items-center justify-center rounded-md transition hover:bg-[#f3f4f6] ${
        active ? 'text-[#1dbf73]' : 'text-[#374151]'
      }`}
    >
      <MessageSquare className="size-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-[#1dbf73] text-[10px] font-semibold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
