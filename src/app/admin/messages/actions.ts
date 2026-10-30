'use server'

import { requireAdmin } from '@/lib/admin/guard'
import { getOrCreateSupportThread } from '@/lib/admin/support'
import { audit } from '@/lib/audit/log'
import { resolveAppUrl } from '@/lib/compliance/notify'
import { sendSupportMessageEmail } from '@/lib/email/resend'
import {
  MAX_ATTACHMENT_BYTES,
  attachmentColumns,
  attachmentTypeFor,
  type MessageAttachment,
} from '@/lib/messaging/attachments'
import { MESSAGE_SELECT, type MessageItem } from '@/lib/messaging/types'

const UUID = /^[0-9a-f-]{36}$/i
const MAX_TEXT = 5000
// Don't email again while an earlier team message is still unread and recent.
const EMAIL_QUIET_MS = 30 * 60 * 1000

type Db = Awaited<ReturnType<typeof requireAdmin>>['db']

async function loadSupportThread(db: Db, conversationId: string) {
  if (!UUID.test(conversationId)) throw new Error('Invalid conversation')
  const { data } = await db
    .from('conversations')
    .select('id, participant_1, is_support')
    .eq('id', conversationId)
    .maybeSingle()
  if (!data?.is_support) throw new Error('Not a support conversation')
  return { id: data.id as string, userId: data.participant_1 as string }
}

/** Get (or create) the support thread for a user. */
export async function ensureSupportThread(userId: string): Promise<string> {
  const { db } = await requireAdmin()
  if (!UUID.test(userId)) throw new Error('Invalid user')
  const { data: profile } = await db.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!profile) throw new Error('User not found')
  return getOrCreateSupportThread(db, userId)
}

export async function sendSupportMessage(input: {
  conversationId: string
  content: string
  attachment: MessageAttachment | null
}): Promise<MessageItem> {
  const { admin, db } = await requireAdmin()
  const thread = await loadSupportThread(db, input.conversationId)

  const content = (input.content ?? '').trim().slice(0, MAX_TEXT)
  const a = input.attachment
  if (a) {
    // The browser uploaded it under {conversation}/{admin}/ (storage RLS
    // enforces the same); re-check so a forged path can't point elsewhere.
    if (
      !a.path.startsWith(`${thread.id}/${admin.id}/`) ||
      a.path.includes('..') ||
      attachmentTypeFor(a.mime) !== a.type ||
      !(a.size > 0 && a.size <= MAX_ATTACHMENT_BYTES)
    ) {
      throw new Error('Invalid attachment')
    }
  }
  if (!content && !a) throw new Error('Message is empty')

  const { data: msg, error } = await db
    .from('messages')
    .insert({
      conversation_id: thread.id,
      sender_id: admin.id,
      content,
      ...attachmentColumns(a),
    })
    .select(MESSAGE_SELECT)
    .single()
  if (error || !msg) throw error ?? new Error('Failed to send')

  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'admin_support_message_sent',
    targetTable: 'messages',
    targetId: msg.id as string,
    metadata: { conversation_id: thread.id, user_id: thread.userId, attachment_type: a?.type ?? null },
  })

  await notifyUser(db, thread.id, thread.userId, msg.id as string)

  return msg as unknown as MessageItem
}

/** In-app notification + (throttled) email. Never throws. */
async function notifyUser(db: Db, conversationId: string, userId: string, messageId: string) {
  const href = `/messages/${conversationId}`
  try {
    const { error } = await db.from('notifications').insert({
      user_id: userId,
      type: 'new_message',
      title: 'New message from the Sanus team',
      body: null,
      data: { href, conversation_id: conversationId },
    })
    if (error) console.error('[admin/messages] notification failed', error)

    const since = new Date(Date.now() - EMAIL_QUIET_MS).toISOString()
    const [{ count: recentUnread }, { data: prefs }, { data: profile }] = await Promise.all([
      db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .neq('id', messageId)
        .is('read_at', null)
        .gte('created_at', since),
      db.from('notification_preferences').select('email_new_message').eq('user_id', userId).maybeSingle(),
      db.from('profiles').select('email').eq('id', userId).maybeSingle(),
    ])
    if ((recentUnread ?? 0) > 0) return
    if (prefs && prefs.email_new_message === false) return
    const email = profile?.email as string | null | undefined
    if (!email) return

    const [{ data: c }, { data: cl }, { data: f }] = await Promise.all([
      db.from('contractor_profiles').select('first_name').eq('id', userId).maybeSingle(),
      db.from('client_profiles').select('first_name').eq('id', userId).maybeSingle(),
      db.from('facility_profiles').select('contact_name').eq('id', userId).maybeSingle(),
    ])
    const firstName =
      (c?.first_name as string | null) ??
      (cl?.first_name as string | null) ??
      ((f?.contact_name as string | null)?.split(' ')[0] ?? null)

    await sendSupportMessageEmail(email, firstName, `${resolveAppUrl().replace(/\/+$/, '')}${href}`)
  } catch (err) {
    console.error('[admin/messages] notify failed', err)
  }
}

/** Mark the user's messages in this thread as read by the team. */
export async function markSupportThreadRead(conversationId: string): Promise<void> {
  const { db } = await requireAdmin()
  const thread = await loadSupportThread(db, conversationId)
  await db
    .from('messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('conversation_id', thread.id)
    .eq('sender_id', thread.userId)
    .is('read_at', null)
}
