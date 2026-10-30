import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { findSupportThread, loadPresence } from '@/lib/admin/support'
import { LiveStatus } from './live-status'
import { audit } from '@/lib/audit/log'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { MESSAGE_SELECT, type MessageItem } from '@/lib/messaging/types'
import { ArrowLeftIcon, MailIcon, PhoneIcon, UserIcon } from 'lucide-react'
import { AdminSupportThread } from './support-thread'

export const dynamic = 'force-dynamic'

export default async function AdminUserMessagesPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  if (isDemoMode()) return <AdminDemoNotice />

  const { userId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound()

  const { admin, db } = await requireAdmin()

  const [{ data: profile }, { data: c }, { data: cl }, { data: f }, conversationId, presence] = await Promise.all([
    db.from('profiles').select('id, role, email, phone').eq('id', userId).maybeSingle(),
    db.from('contractor_profiles').select('first_name, last_name').eq('id', userId).maybeSingle(),
    db.from('client_profiles').select('first_name, last_name').eq('id', userId).maybeSingle(),
    db.from('facility_profiles').select('facility_name').eq('id', userId).maybeSingle(),
    findSupportThread(db, userId),
    loadPresence(db, [userId]),
  ])
  if (!profile) notFound()

  const name =
    (c && `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()) ||
    (f?.facility_name as string | undefined) ||
    (cl && `${cl.first_name ?? ''} ${cl.last_name ?? ''}`.trim()) ||
    (profile.email as string | null) ||
    userId

  let messages: MessageItem[] = []
  const adminNames: Record<string, string> = {}
  if (conversationId) {
    const { data } = await db
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    messages = (data ?? []) as unknown as MessageItem[]

    const senderIds = [...new Set(messages.map((m) => m.sender_id).filter((id) => id !== userId))]
    if (senderIds.length) {
      const { data: admins } = await db.from('profiles').select('id, email').in('id', senderIds)
      for (const a of admins ?? []) {
        adminNames[a.id as string] = ((a.email as string | null) ?? 'Admin').split('@')[0]
      }
    }
  }

  // Support messages and attachments can contain PHI.
  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'admin_view_support_thread',
    targetTable: 'conversations',
    targetId: conversationId ?? undefined,
    phiAccessed: true,
    metadata: { user_id: userId },
  })

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3 font-sans">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4e5e7] pb-3">
        <Link
          href="/admin/messages"
          className="inline-flex items-center gap-1 text-sm text-[#62646a] hover:text-[#1dbf73]"
        >
          <ArrowLeftIcon className="size-4" /> All messages
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-[#404145]">{name}</h1>
            {profile.role && <Badge variant="outline">{profile.role as string}</Badge>}
            <LiveStatus userId={userId} initialLastSeen={presence[userId] ?? null} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {profile.email && (
              <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1 text-[#0f8f56] hover:underline">
                <MailIcon className="size-3" /> {profile.email as string}
              </a>
            )}
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-1 text-[#0f8f56] hover:underline">
                <PhoneIcon className="size-3" /> {profile.phone as string}
              </a>
            )}
            <Link href={`/admin/users/${userId}`} className="inline-flex items-center gap-1 text-[#62646a] hover:text-[#1dbf73] hover:underline">
              <UserIcon className="size-3" /> Full profile
            </Link>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#e4e5e7] bg-white">
        <AdminSupportThread
          userId={userId}
          adminId={admin.id}
          initialConversationId={conversationId}
          initialMessages={messages}
          adminNames={adminNames}
        />
      </div>
    </div>
  )
}
