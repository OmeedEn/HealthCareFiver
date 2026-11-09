import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { listAdminUsers } from '@/lib/admin/data'
import { listSupportThreads, loadPresence } from '@/lib/admin/support'
import { AutoRefresh } from '@/components/admin/auto-refresh'
import { PresenceDot, ReplyStateBadge, isOnline, lastSeenLabel } from '@/components/admin/presence-dot'
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
  const nonAdmins = users.filter((u) => u.role !== 'admin')
  const presence = await loadPresence(db, nonAdmins.map((u) => u.id))
  // eslint-disable-next-line react-hooks/purity -- server render; "now" for online status
  const now = Date.now()
  const byId = new Map(users.map((u) => [u.id, u]))
  const recipients = nonAdmins
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      lastSeenAt: presence[u.id] ?? null,
      online: isOnline(presence[u.id], now),
    }))
    .sort((a, b) => Number(b.online) - Number(a.online))
  const unreadTotal = threads.reduce((n, t) => n + t.unread, 0)
  const needsReplyTotal = threads.filter((t) => t.needsReply).length
  const onlineTotal = recipients.filter((r) => r.online).length

  return (
    <div className="space-y-6 font-sans">
      <AutoRefresh seconds={30} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[#1a1a17]">Messages</h2>
          <p className="text-sm text-[#5f5d57]">
            Message any user as the Sanus team. They can reply with text, photos, voice messages or video.
          </p>
        </div>
        <RecipientPicker recipients={recipients} now={now} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-[#1a1a17]">Conversations</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5f5d57]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-[#2f3cf5]" />
              {onlineTotal} online
            </span>
            {needsReplyTotal > 0 && (
              <Badge className="bg-amber-100 text-amber-800">{needsReplyTotal} need a reply</Badge>
            )}
            {unreadTotal > 0 && <Badge className="bg-[#2f3cf5] text-white">{unreadTotal} unread</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {threads.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#eceefe]">
                <MessageSquareIcon className="size-6 text-[#2330c8]" />
              </div>
              <p className="text-sm text-[#5f5d57]">
                No conversations yet. Use <strong>New message</strong> to contact someone.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {threads.map((t) => {
                const u = byId.get(t.userId)
                const name = u ? (u.name !== '—' ? u.name : u.email ?? t.userId) : t.userId.slice(0, 8)
                return (
                  <li key={t.id} className="border-b border-[#eeebe4] last:border-0">
                    <Link
                      href={`/admin/messages/${t.userId}`}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-3 hover:bg-[#f6f4ef]',
                        t.needsReply && 'border-l-2 border-amber-400',
                        t.unread > 0 && 'bg-[#f4f5fe]'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <PresenceDot lastSeenAt={presence[t.userId]} now={now} />
                          <span className={cn('truncate text-sm text-[#1a1a17]', t.unread > 0 ? 'font-semibold' : 'font-medium')}>
                            {name}
                          </span>
                          {u?.role && <Badge variant="outline" className="text-[10px]">{u.role}</Badge>}
                          <ReplyStateBadge needsReply={t.needsReply} awaitingUser={t.awaitingUser} />
                        </div>
                        <p className="truncate text-xs text-[#5f5d57]">
                          {t.lastMessagePreview ?? 'No messages yet'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-[#706d65]">
                          {t.lastMessageAt ? formatRelativeTime(t.lastMessageAt) : ''}
                        </span>
                        <span className="text-[11px] text-[#706d65]">{lastSeenLabel(presence[t.userId], now)}</span>
                        {t.unread > 0 && (
                          <span className="rounded-full bg-[#2f3cf5] px-1.5 text-[11px] font-semibold leading-[18px] text-white">
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
