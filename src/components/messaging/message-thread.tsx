'use client'

import { useEffect, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDate, formatDateTime, getInitials } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

export interface MessageItem {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

interface MessageThreadProps {
  messages: MessageItem[]
  currentUserId: string
  otherUser?: {
    first_name: string
    last_name: string
    avatar_url: string | null
  }
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function MessageThread({
  messages,
  currentUserId,
  otherUser,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <p className="text-muted-foreground">
          No messages yet. Send the first message!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
      {messages.map((msg, idx) => {
        const isOwn = msg.sender_id === currentUserId
        const showDateSeparator =
          idx === 0 || !isSameDay(messages[idx - 1].created_at, msg.created_at)

        return (
          <div key={msg.id}>
            {showDateSeparator && (
              <div className="my-3 flex items-center justify-center">
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {formatDate(msg.created_at)}
                </span>
              </div>
            )}
            <div
              className={cn(
                'flex items-end gap-2',
                isOwn ? 'justify-end' : 'justify-start'
              )}
            >
              {!isOwn && otherUser && (
                <Avatar size="sm">
                  {otherUser.avatar_url && (
                    <AvatarImage
                      src={otherUser.avatar_url}
                      alt={`${otherUser.first_name} ${otherUser.last_name}`}
                    />
                  )}
                  <AvatarFallback>
                    {getInitials(otherUser.first_name, otherUser.last_name)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                  isOwn
                    ? 'rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md bg-muted text-foreground'
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className={cn(
                    'mt-1 text-[10px]',
                    isOwn
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  )}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
