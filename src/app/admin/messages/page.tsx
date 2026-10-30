import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { listAdminUsers } from '@/lib/admin/data'
import { listSupportThreads } from '@/lib/admin/support'
import { formatRelativeTime } from '@/lib/utils/format'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { cn } from '@/lib/utils'
import { MessageSquareIcon } from 'lucide-react'
import { RecipientPicker } from './recipient-picker'

export const dynamic = 'force-dynamic'

export default async function AdminMessagesPage() {
  if (isDemoMode()) return <AdminDemoNotice />

  const { db } = await requireAdmin()
  const [threads, users] = await Promise.all([listSupportThreads(db), listAdminUsers(db)])
  const byId = new Map(users.map((u) => [u.id, u]))
  const recipients = users
    .filter((u) => u.role !== 'admin')
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
  const unreadTotal = threads.reduce((n, t) => n + t.unread, 0)

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#404145]">Messages</h1>
          <p className="text-sm text-[#62646a]">
            Message any user as the Sanus team. They can reply with text, photos, voice messages or video.
          </p>
        </div>
        <RecipientPicker recipients={recipients} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-[#404145]">Conversations</CardTitle>
          {unreadTotal > 0 && <Badge className="bg-[#1dbf73] text-white">{unreadTotal} unread</Badge>}
        </CardHeader>
        <CardContent>
          {threads.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                <MessageSquareIcon className="size-6 text-[#0f8f56]" />
              </div>
              <p className="text-sm text-[#62646a]">
                No conversations yet. Use <strong>New message</strong> to contact someone.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {threads.map((t) => {
                const u = byId.get(t.userId)
                const name = u ? (u.name !== '—' ? u.name : u.email ?? t.userId) : t.userId.slice(0, 8)
                return (
                  <li key={t.id} className="border-b border-[#f1f3f5] last:border-0">
                    <Link
                      href={`/admin/messages/${t.userId}`}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-3 hover:bg-[#f7f7f7]',
                        t.unread > 0 && 'bg-[#f3fcf7]'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('truncate text-sm text-[#404145]', t.unread > 0 ? 'font-semibold' : 'font-medium')}>
                            {name}
                          </span>
                          {u?.role && <Badge variant="outline" className="text-[10px]">{u.role}</Badge>}
                        </div>
                        <p className="truncate text-xs text-[#62646a]">
                          {t.lastMessagePreview ?? 'No messages yet'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-[#9ca3af]">
                          {t.lastMessageAt ? formatRelativeTime(t.lastMessageAt) : ''}
                        </span>
                        {t.unread > 0 && (
                          <span className="rounded-full bg-[#1dbf73] px-1.5 text-[11px] font-semibold leading-[18px] text-white">
                            {t.unread}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
