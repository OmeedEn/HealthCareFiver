'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_NOTIFICATIONS } from '@/lib/demo/data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils/format'
import { toast } from 'sonner'
import {
  Bell,
  MessageSquare,
  Briefcase,
  FileText,
  AlertCircle,
  DollarSign,
  CheckCheck,
  Loader2,
} from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

const typeIcons: Record<string, React.ReactNode> = {
  message: <MessageSquare className="size-5 text-blue-500" />,
  application: <Briefcase className="size-5 text-green-500" />,
  contract: <FileText className="size-5 text-purple-500" />,
  payment: <DollarSign className="size-5 text-emerald-500" />,
  alert: <AlertCircle className="size-5 text-red-500" />,
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const isDemo = isDemoMode()

  useEffect(() => {
    if (isDemo) {
      setNotifications(DEMO_NOTIFICATIONS as unknown as Notification[])
      setLoading(false)
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

      setNotifications((data ?? []) as unknown as Notification[])
      setLoading(false)
    }

    fetchNotifications()

    // Subscribe to realtime
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications((prev) => [newNotification, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isDemo])

  async function markAsRead(id: string) {
    if (isDemo) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return

    if (isDemo) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      )
      toast.success('All notifications marked as read')
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds)

    if (error) {
      toast.error('Failed to mark notifications as read')
    } else {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      )
      toast.success('All notifications marked as read')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="size-4" data-icon="inline-start" />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 font-medium">No notifications</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                !notification.is_read ? 'border-l-2 border-l-blue-500' : ''
              }`}
              onClick={() => !notification.is_read && markAsRead(notification.id)}
            >
              <CardContent className="flex items-start gap-3 py-3">
                <span className="mt-0.5 shrink-0">
                  {typeIcons[notification.type] ?? (
                    <Bell className="size-5 text-gray-500" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      notification.is_read
                        ? 'text-muted-foreground'
                        : 'font-medium'
                    }`}
                  >
                    {notification.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>
                {!notification.is_read && (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
