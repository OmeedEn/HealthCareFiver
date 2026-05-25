'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_NOTIFICATIONS } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatRelativeTime } from '@/lib/utils/format'
import { Bell, MessageSquare, Briefcase, FileText, AlertCircle, DollarSign } from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

const typeIcons: Record<string, React.ReactNode> = {
  message: <MessageSquare className="size-4 text-blue-500" />,
  application: <Briefcase className="size-4 text-green-500" />,
  contract: <FileText className="size-4 text-purple-500" />,
  payment: <DollarSign className="size-4 text-emerald-500" />,
  alert: <AlertCircle className="size-4 text-red-500" />,
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (isDemoMode()) {
      const demoNotifs = DEMO_NOTIFICATIONS.slice(0, 5) as unknown as Notification[]
      setNotifications(demoNotifs)
      setUnreadCount(demoNotifs.filter((n) => !n.is_read).length)
      return
    }

    const supabase = createClient()

    async function fetchNotifications() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (data) {
        setNotifications(data as Notification[])
      }

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      setUnreadCount(count ?? 0)
    }

    fetchNotifications()

    // Subscribe to realtime notifications
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications((prev) => [newNotification, ...prev].slice(0, 5))
          setUnreadCount((prev) => prev + 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          )
          if (updated.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function markAsRead(id: string) {
    if (!isDemoMode()) {
      const supabase = createClient()
      supabase.from('notifications').update({ is_read: true }).eq('id', id)
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex items-center justify-center rounded-lg p-2 hover:bg-gray-100 outline-none"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 p-0 text-[10px] flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
        <span className="sr-only">Notifications</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">Notifications</p>
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className="flex items-start gap-2 py-2"
            >
              <span className="mt-0.5 shrink-0">
                {typeIcons[notification.type] ?? (
                  <Bell className="size-4 text-gray-500" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm truncate ${notification.is_read ? 'text-muted-foreground' : 'font-medium'}`}
                >
                  {notification.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {notification.body}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRelativeTime(notification.created_at)}
                </p>
              </div>
              {!notification.is_read && (
                <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />
              )}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center" render={<Link href="/notifications" />}>
          View All
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
