'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_CONVERSATIONS, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import {
  ConversationList,
  type ConversationItem,
} from '@/components/messaging/conversation-list'
import { MessageSquarePlusIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
    if (isDemoMode()) {
      setCurrentUserId(DEMO_CONTRACTOR.id)
      setConversations(DEMO_CONVERSATIONS as unknown as ConversationItem[])
      setLoading(false)
      return
    }

    setLoading(true)
    fetchConversations().finally(() => setLoading(false))
  }, [fetchConversations])

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            Your conversations with facilities and contractors
          </p>
        </div>
        <Button variant="outline" disabled>
          <MessageSquarePlusIcon className="size-4" data-icon="inline-start" />
          New Conversation
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : currentUserId ? (
        <ConversationList
          conversations={conversations}
          currentUserId={currentUserId}
        />
      ) : null}
    </div>
  )
}
