import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminDb = ReturnType<typeof createAdminClient>

/**
 * Support threads: conversations with is_support = true and
 * participant_1 = participant_2 = the user (see
 * supabase/migrations/20261029100100_support_messaging.sql).
 */

export async function findSupportThread(db: AdminDb, userId: string): Promise<string | null> {
  const { data } = await db
    .from('conversations')
    .select('id')
    .eq('is_support', true)
    .eq('participant_1', userId)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

export async function getOrCreateSupportThread(db: AdminDb, userId: string): Promise<string> {
  const existing = await findSupportThread(db, userId)
  if (existing) return existing
  const { data, error } = await db
    .from('conversations')
    .insert({ participant_1: userId, participant_2: userId, is_support: true })
    .select('id')
    .single()
  if (data?.id) return data.id as string
  // Lost a race with the user (or another admin) creating it.
  const again = await findSupportThread(db, userId)
  if (again) return again
  throw error ?? new Error('Could not create support thread')
}

export interface SupportThreadRow {
  id: string
  userId: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unread: number
}

/**
 * Messages the users sent that no admin has read yet, grouped by thread.
 * PostgREST can't compare two columns, so filter sender = thread user here.
 */
export async function unreadSupportCounts(db: AdminDb): Promise<Map<string, number>> {
  const { data } = await db
    .from('messages')
    .select('conversation_id, sender_id, conversations!inner(is_support, participant_1)')
    .eq('conversations.is_support', true)
    .is('read_at', null)
    .limit(5000)
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const c = row.conversations as unknown as { participant_1: string } | null
    if (c && row.sender_id === c.participant_1) {
      const id = row.conversation_id as string
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

export async function countUnreadSupport(db: AdminDb): Promise<number> {
  let total = 0
  for (const n of (await unreadSupportCounts(db)).values()) total += n
  return total
}

export async function listSupportThreads(db: AdminDb): Promise<SupportThreadRow[]> {
  const [{ data }, unread] = await Promise.all([
    db
      .from('conversations')
      .select('id, participant_1, last_message_at, last_message_preview, created_at')
      .eq('is_support', true)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(500),
    unreadSupportCounts(db),
  ])
  return (data ?? []).map((c) => ({
    id: c.id as string,
    userId: c.participant_1 as string,
    lastMessageAt: (c.last_message_at as string | null) ?? null,
    lastMessagePreview: (c.last_message_preview as string | null) ?? null,
    unread: unread.get(c.id as string) ?? 0,
  }))
}
