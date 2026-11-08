'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_NOTIFICATIONS } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatRelativeTime } from '@/lib/utils/format'
import {
  Bell,
  MessageSquare,
  Briefcase,
  FileText,
  DollarSign,
  AlertCircle,
  Star,
} from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

// Map every notification_type enum from the schema to an icon. Defaults to
// Bell if a new type ships before this map is updated.
const typeIcon: Record<string, React.ReactNode> = {
  new_message: <MessageSquare className="size-4 text-[#2f3cf5]" />,
  application_received: <Briefcase className="size-4 text-[#2f3cf5]" />,
  application_status_change: <Briefcase className="size-4 text-[#2f3cf5]" />,
  job_match: <Briefcase className="size-4 text-[#2f3cf5]" />,
  contract_update: <FileText className="size-4 text-[#2f3cf5]" />,
  timesheet_submitted: <FileText className="size-4 text-[#2f3cf5]" />,
  timesheet_approved: <FileText className="size-4 text-[#2f3cf5]" />,
  payment_received: <DollarSign className="size-4 text-[#2f3cf5]" />,
  payment_released: <DollarSign className="size-4 text-[#2f3cf5]" />,
  credential_expiring: <AlertCircle className="size-4 text-amber-500" />,
  credential_verified: <FileText className="size-4 text-[#2f3cf5]" />,
  credential_rejected: <AlertCircle className="size-4 text-red-500" />,
  review_received: <Star className="size-4 text-[#2f3cf5]" />,
  dispute_opened: <AlertCircle className="size-4 text-red-500" />,
}

const DROPDOWN_LIMIT = 5

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    isDemoMode() ? (DEMO_NOTIFICATIONS as unknown as Notification[]) : [],
  )

  useEffect(() => {
    if (isDemoMode()) return
    const supabase = createClient()
    let cancelled = false

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (!cancelled) {
        setNotifications((data ?? []) as unknown as Notification[])
      }
    }

    load()

    // Realtime: keep the bell's unread count fresh while the user is on a page
    // that doesn't include the full /notifications view.
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const row = payload.new as Notification
          setNotifications((prev) => [row, ...prev].slice(0, 10))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload) => {
          const row = payload.new as Notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? row : n)),
          )
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const recent = notifications.slice(0, DROPDOWN_LIMIT)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Notifications${
              unreadCount > 0 ? ` (${unreadCount} unread)` : ''
            }`}
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-[#2f3cf5] text-[10px] font-semibold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-[#e3dfd6] px-3 py-2">
          <p className="text-sm font-semibold text-[#1a1a17]">Notifications</p>
          {unreadCount > 0 && (
            <span className="text-xs text-[#5f5d57]">{unreadCount} unread</span>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#eceefe]">
              <Bell className="size-5 text-[#2f3cf5]" />
            </div>
            <p className="mt-3 text-sm font-medium text-[#1a1a17]">
              No notifications
            </p>
            <p className="mt-1 text-xs text-[#5f5d57]">You&apos;re all caught up.</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {recent.map((n) => (
              <Link
                key={n.id}
                href="/notifications"
                className={`flex items-start gap-3 border-b border-[#eeebe4] px-3 py-3 last:border-0 hover:bg-[#f6f4ef] ${
                  !n.is_read ? 'bg-[#f4f5fe]' : ''
                }`}
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eceefe]">
                  {typeIcon[n.type] ?? (
                    <Bell className="size-4 text-[#2f3cf5]" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-tight ${
                      n.is_read
                        ? 'text-[#5f5d57]'
                        : 'font-medium text-[#1a1a17]'
                    }`}
                  >
                    {n.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#5f5d57]">
                    {n.body}
                  </p>
                  <p className="mt-1 text-xs text-[#5f5d57]">
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-[#2f3cf5]" />
                )}
              </Link>
            ))}
          </div>
        )}

        <Link
          href="/notifications"
          className="block border-t border-[#e3dfd6] px-3 py-2 text-center text-sm font-medium text-[#2f3cf5] hover:bg-[#f6f4ef]"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
