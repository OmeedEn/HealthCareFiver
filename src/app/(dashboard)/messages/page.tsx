'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_CONVERSATIONS, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  ConversationList,
  type ConversationItem,
} from '@/components/messaging/conversation-list'
import {
  Loader2Icon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  SearchIcon,
} from 'lucide-react'
import { toast } from 'sonner'

export default function MessagesPage() {
  const isDemo = isDemoMode()
  const [conversations, setConversations] = useState<ConversationItem[]>(() =>
    isDemo ? (DEMO_CONVERSATIONS as unknown as ConversationItem[]) : []
  )
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    isDemo ? DEMO_CONTRACTOR.id : null
  )
  const [loading, setLoading] = useState(!isDemo)
  const [search, setSearch] = useState('')

  const fetchConversations = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const { data, error } = await supabase
      .from('conversations')
      .select(
        '*, participant_1_profile:profiles!conversations_participant_1_fkey(user_id, first_name, last_name, avatar_url, role), participant_2_profile:profiles!conversations_participant_2_fkey(user_id, first_name, last_name, avatar_url, role)'
      )
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) {
      toast.error('Failed to load conversations.')
      return
    }

    const mapped: ConversationItem[] = (data ?? []).map(
      (row: Record<string, unknown>) => {
        const p1 = row.participant_1_profile as {
          user_id: string
          first_name: string
          last_name: string
          avatar_url: string | null
          role: string
        } | null
        const p2 = row.participant_2_profile as {
          user_id: string
          first_name: string
          last_name: string
          avatar_url: string | null
          role: string
        } | null

        const isP1 = row.participant_1 === user.id
        const other = isP1 ? p2 : p1

        return {
          id: row.id as string,
          participant_1: row.participant_1 as string,
          participant_2: row.participant_2 as string,
          last_message_preview: row.last_message_preview as string | null,
          last_message_at: row.last_message_at as string | null,
          unread_count_1: (row.unread_count_1 as number) ?? 0,
          unread_count_2: (row.unread_count_2 as number) ?? 0,
          created_at: row.created_at as string,
          other_user: {
            id: other?.user_id ?? '',
            first_name: other?.first_name ?? 'Unknown',
            last_name: other?.last_name ?? '',
            avatar_url: other?.avatar_url ?? null,
            role: other?.role ?? 'contractor',
          },
        }
      }
    )

    setConversations(mapped)
  }, [])

  useEffect(() => {
    if (isDemo) return

    let cancelled = false
    fetchConversations().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isDemo, fetchConversations])

  // Subscribe to realtime updates on conversations table
  useEffect(() => {
    if (!currentUserId || isDemoMode()) return

    const supabase = createClient()
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined
          if (!row) return
          // Only care about conversations we participate in
          if (
            row.participant_1 !== currentUserId &&
            row.participant_2 !== currentUserId
          )
            return
          // Refetch to get joined profile data
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, fetchConversations])

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const name =
        `${c.other_user.first_name} ${c.other_user.last_name}`.toLowerCase()
      const preview = (c.last_message_preview ?? '').toLowerCase()
      return name.includes(q) || preview.includes(q)
    })
  }, [conversations, search])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">Messages</h1>
          <p className="text-[#62646a]">
            Your conversations with facilities and contractors
          </p>
        </div>
        <Button
          className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
          disabled
        >
          <MessageSquarePlusIcon className="size-4" data-icon="inline-start" />
          New Conversation
        </Button>
      </div>

      <Card>
        <CardContent>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#6b7280]" />
            <Input
              type="search"
              placeholder="Search by name or message"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="size-6 animate-spin text-[#1dbf73]" />
        </div>
      ) : currentUserId ? (
        filteredConversations.length === 0 ? (
          <Card>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                  <MessageSquareIcon className="size-6 text-[#1dbf73]" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#404145]">
                  {search ? 'No matching conversations' : 'No messages yet'}
                </h3>
                <p className="mt-1 max-w-sm text-sm text-[#62646a]">
                  {search
                    ? 'Try a different name or keyword to find a conversation.'
                    : 'Apply to jobs to start a conversation with facility contacts. New messages will appear here.'}
                </p>
                {!search && (
                  <Link href="/contractor/jobs" className="mt-6">
                    <Button className="bg-[#1dbf73] text-white hover:bg-[#19a463]">
                      Browse jobs
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <ConversationList
                conversations={filteredConversations}
                currentUserId={currentUserId}
              />
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  )
}
