'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/guard'

/**
 * Open the Sanus-team support thread with `userId` in the admin inbox.
 * The thread itself is created on the first message (see
 * src/app/admin/messages/actions.ts), so opening it has no side effects.
 */
export async function messageUser(userId: string) {
  const { admin } = await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid user')
  if (userId === admin.id) throw new Error("You can't message yourself")
  redirect(`/admin/messages/${userId}`)
}
