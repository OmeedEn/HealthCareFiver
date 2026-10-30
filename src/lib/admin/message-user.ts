'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/guard'

/**
 * Open (or start) an in-app chat between the signed-in admin and `userId`,
 * then send the admin to that thread in /messages.
 */
export async function messageUser(userId: string) {
  const { admin, db } = await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid user')
  if (userId === admin.id) throw new Error("You can't message yourself")

  // conversations is unique on (participant_1, participant_2), so look both ways.
  const { data: existing, error: findError } = await db
    .from('conversations')
    .select('id')
    .or(
      `and(participant_1.eq.${admin.id},participant_2.eq.${userId}),and(participant_1.eq.${userId},participant_2.eq.${admin.id})`
    )
    .limit(1)
    .maybeSingle()
  if (findError) throw new Error('Could not open conversation')

  let conversationId = existing?.id as string | undefined
  if (!conversationId) {
    const { data: created, error } = await db
      .from('conversations')
      .insert({ participant_1: admin.id, participant_2: userId })
      .select('id')
      .single()
    if (error || !created) throw new Error('Could not start conversation')
    conversationId = created.id as string
  }

  redirect(`/messages/${conversationId}`)
}
