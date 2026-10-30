'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLiveMessages } from '@/components/messaging/use-live-messages'
import { MessageThread } from '@/components/messaging/message-thread'
import { MessageInput } from '@/components/messaging/message-input'
import { uploadAttachment } from '@/lib/messaging/attachments'
import type { MessageItem } from '@/lib/messaging/types'
import { toast } from 'sonner'
import { ensureSupportThread, markSupportThreadRead, sendSupportMessage } from '../actions'

export function AdminSupportThread({
  userId,
  adminId,
  initialConversationId,
  initialMessages,
  adminNames,
}: {
  userId: string
  adminId: string
  initialConversationId: string | null
  initialMessages: MessageItem[]
  adminNames: Record<string, string>
}) {
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [messages, setMessages] = useState(initialMessages)

  const addMessage = useCallback((m: MessageItem) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
  }, [])

  // Mark the user's messages read when the thread is opened.
  useEffect(() => {
    if (conversationId && initialMessages.some((m) => m.sender_id === userId && !m.read_at)) {
      markSupportThreadRead(conversationId).catch(() => {})
    }
  }, [conversationId, initialMessages, userId])

  // Live updates (user replies, other admins' messages).
  const onLive = useCallback(
    (m: MessageItem) => {
      addMessage(m)
      if (conversationId && m.sender_id === userId && !m.read_at) {
        markSupportThreadRead(conversationId).catch(() => {})
      }
    },
    [addMessage, conversationId, userId]
  )
  useLiveMessages(conversationId, messages.at(-1)?.created_at ?? null, onLive)

  async function handleSend(content: string, file: File | null) {
    try {
      let id = conversationId
      if (!id) {
        id = await ensureSupportThread(userId)
        setConversationId(id)
      }
      const attachment = file ? await uploadAttachment(createClient(), id, adminId, file) : null
      const msg = await sendSupportMessage({ conversationId: id, content, attachment })
      addMessage(msg)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message.')
      throw err
    }
  }

  return (
    <>
      <MessageThread
        messages={messages}
        currentUserId={adminId}
        isOwn={(m) => m.sender_id !== userId}
        senderLabel={(m) =>
          m.sender_id !== userId && m.sender_id !== adminId ? adminNames[m.sender_id] ?? 'Another admin' : null
        }
        emptyText="No messages yet. Write the first one below. They'll get an email and an in-app notification."
      />
      <MessageInput onSend={handleSend} allowAttachments placeholder="Message as the Sanus team..." />
    </>
  )
}
