'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_MESSAGES, DEMO_CONVERSATIONS, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  MessageThread,
  type MessageItem,
} from '@/components/messaging/message-thread'
import { MessageInput } from '@/components/messaging/message-input'
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

interface OtherUser {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
}

function getDemoInitialState(conversationId: string) {
  const convo = (DEMO_CONVERSATIONS as Record<string, unknown>[]).find(
    (c) => c.id === conversationId,
  )
  // DEMO_CONVERSATIONS stores other_user as { name, role, avatar_url, email }
  // — a single display name string — but the real query returns separate
  // first_name + last_name. Split on the last space so honorifics like "Dr."
  // stay with the first name.
  const demoOther = convo?.other_user as
    | { name: string; avatar_url: string | null }
    | undefined
  let otherUser: OtherUser | null = null
  if (demoOther) {
    const parts = demoOther.name.trim().split(/\s+/)
    const last_name = parts.length > 1 ? parts.pop()! : ''
    const first_name = parts.join(' ')
    otherUser = {
      id: convo?.participant_2 as string,
      first_name,
      last_name,
      avatar_url: demoOther.avatar_url,
    }
  }
  const convoMessages = (DEMO_MESSAGES as unknown as MessageItem[]).filter(
    (m) => m.conversation_id === conversationId,
  )
  return {
    messages: convoMessages,
    otherUser,
  }
}

export default function ConversationPage() {
  const params = useParams()
  const conversationId = params.conversationId as string
  const isDemo = isDemoMode()

  const initialDemo = isDemo
    ? getDemoInitialState(conversationId)
    : { messages: [], otherUser: null }

  const [messages, setMessages] = useState<MessageItem[]>(
    () => initialDemo.messages
  )
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    isDemo ? DEMO_CONTRACTOR.id : null
  )
  const [otherUser, setOtherUser] = useState<OtherUser | null>(
    initialDemo.otherUser
  )
  const [loading, setLoading] = useState(!isDemo)

  const fetchMessages = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    // Fetch conversation to get other participant
    const { data: convo } = await supabase
      .from('conversations')
      .select(
        '*, participant_1_profile:profiles!conversations_participant_1_fkey(user_id, first_name, last_name, avatar_url), participant_2_profile:profiles!conversations_participant_2_fkey(user_id, first_name, last_name, avatar_url)'
      )
      .eq('id', conversationId)
      .single()

    if (convo) {
      const isP1 = convo.participant_1 === user.id
      const otherProfile = isP1
        ? (convo.participant_2_profile as OtherUser | null)
        : (convo.participant_1_profile as OtherUser | null)

      if (otherProfile) {
        setOtherUser({
          id: otherProfile.id ?? (isP1 ? convo.participant_2 : convo.participant_1),
          first_name: otherProfile.first_name,
          last_name: otherProfile.last_name,
          avatar_url: otherProfile.avatar_url,
        })
      }

      // Mark messages as read
      const unreadField = isP1 ? 'unread_count_1' : 'unread_count_2'
      await supabase
        .from('conversations')
        .update({ [unreadField]: 0 })
        .eq('id', conversationId)

      // Mark individual messages as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null)
    }

    // Fetch messages
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, read_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('Failed to load messages.')
      return
    }

    setMessages((msgs ?? []) as unknown as MessageItem[])
  }, [conversationId])

  useEffect(() => {
    if (isDemo) return

    let cancelled = false
    fetchMessages().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isDemo, fetchMessages])

  // Subscribe to realtime messages
  useEffect(() => {
    if (!currentUserId || isDemo) return

    const supabase = createClient()
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageItem
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          // Mark as read if it's not our own message
          if (newMsg.sender_id !== currentUserId) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .then()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, isDemo])

  const handleSend = async (content: string) => {
    if (!currentUserId) return

    if (isDemoMode()) {
      const newMsg: MessageItem = {
        id: `demo-msg-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        created_at: new Date().toISOString(),
        read_at: null,
      }
      setMessages((prev) => [...prev, newMsg])
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
    })

    if (error) {
      toast.error('Failed to send message.')
      throw error
    }

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message_preview: content.slice(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
  }

  const otherName = otherUser
    ? `${otherUser.first_name} ${otherUser.last_name}`.trim()
    : 'Conversation'
  const initials = otherUser
    ? `${otherUser.first_name?.[0] ?? ''}${otherUser.last_name?.[0] ?? ''}`
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#e4e5e7] pb-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to messages"
          render={<Link href="/messages" />}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <Avatar size="sm">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-[#404145]">
            {otherName}
          </h1>
        </div>
      </div>

      {/* Messages */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-[#1dbf73]" />
        </div>
      ) : currentUserId ? (
        <>
          <MessageThread
            messages={messages}
            currentUserId={currentUserId}
            otherUser={
              otherUser
                ? {
                    first_name: otherUser.first_name,
                    last_name: otherUser.last_name,
                    avatar_url: otherUser.avatar_url,
                  }
                : undefined
            }
          />
          <MessageInput onSend={handleSend} />
        </>
      ) : null}
    </div>
  )
}
