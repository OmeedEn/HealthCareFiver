'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime, getInitials } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

export interface ConversationItem {
  id: string
  participant_1: string
  participant_2: string
  last_message_preview: string | null
  last_message_at: string | null
  unread_count_1: number
  unread_count_2: number
  created_at: string
  other_user: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
    role: string
  }
}

interface ConversationListProps {
  conversations: ConversationItem[]
  currentUserId: string
}

export function ConversationList({
  conversations,
  currentUserId,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg font-medium">No conversations yet</p>
        <p className="mt-1 text-muted-foreground">
          Start a conversation to connect with facilities or contractors.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {conversations.map((convo) => {
        const unreadCount =
          convo.participant_1 === currentUserId
            ? convo.unread_count_1
            : convo.unread_count_2
        const isUnread = unreadCount > 0
        const other = convo.other_user

        return (
          <Link key={convo.id} href={`/messages/${convo.id}`}>
            <Card
              size="sm"
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/50',
                isUnread && 'border-primary/30 bg-primary/5'
              )}
            >
              <CardContent className="flex items-center gap-3">
                <Avatar>
                  {other.avatar_url && (
                    <AvatarImage
                      src={other.avatar_url}
                      alt={`${other.first_name} ${other.last_name}`}
                    />
                  )}
                  <AvatarFallback>
                    {getInitials(other.first_name, other.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-sm',
                        isUnread ? 'font-semibold' : 'font-medium'
                      )}
                    >
                      {other.first_name} {other.last_name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {convo.last_message_at
                        ? formatRelativeTime(convo.last_message_at)
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        'truncate text-xs',
                        isUnread
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {convo.last_message_preview || 'No messages yet'}
                    </p>
                    {isUnread && (
                      <Badge className="shrink-0 tabular-nums">
                        {unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
