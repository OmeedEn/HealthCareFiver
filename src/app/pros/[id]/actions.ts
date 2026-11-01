'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { isDemoMode } from '@/lib/demo/data'
import { getPublicProfile } from '@/lib/find-care/profile'
import { isClassificationRestricted } from '@/lib/onboarding/signup-path'
import { createClient } from '@/lib/supabase/server'

export type StartConversationState = { error?: string }

/** Roles that may open a conversation with a professional. */
const CAN_MESSAGE = new Set(['client', 'facility', 'staffing_agency'])
const ORG_ROLES = new Set(['facility', 'staffing_agency'])

/**
 * Open (or reuse) a direct conversation with a live professional, then go to
 * it. Runs with the caller's own session so RLS gates still apply.
 */
export async function startConversation(
  proId: string,
  _prev: StartConversationState,
  _form: FormData
): Promise<StartConversationState> {
  if (!z.string().uuid().safeParse(proId).success) {
    return { error: 'This professional could not be found.' }
  }
  if (isDemoMode()) return { error: 'Messaging is disabled in demo mode.' }

  const { currentUser } = await import('@/lib/auth/roles')
  const user = await currentUser()
  if (!user) redirect(`/login?redirectTo=/pros/${proId}`)
  if (user.id === proId) return { error: "You can't message yourself." }
  if (!CAN_MESSAGE.has(user.role)) {
    return { error: 'Only clients and organizations can message professionals.' }
  }

  // Same visibility rule as the profile page (live professionals only).
  const pro = await getPublicProfile(proId, null)
  if (!pro?.isPublic) return { error: 'This professional is not available to message.' }

  const supabase = await createClient()

  // Friendlier messages for the RLS gates on conversations insert.
  const { data: me } = await supabase
    .from('profiles')
    .select('signup_path, classification_status')
    .eq('id', user.id)
    .maybeSingle()
  if (me && isClassificationRestricted(me)) {
    return { error: "Messaging professionals isn't available on your account yet." }
  }
  if (ORG_ROLES.has(user.role)) {
    const { data: org } = await supabase
      .from('facility_profiles')
      .select('verification_status')
      .eq('id', user.id)
      .maybeSingle()
    if (org && org.verification_status !== 'approved') {
      return { error: 'Your organization needs to be approved before messaging.' }
    }
  }

  const findExisting = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('is_support', false)
      .or(
        `and(participant_1.eq.${user.id},participant_2.eq.${proId}),and(participant_1.eq.${proId},participant_2.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return (data?.id as string | undefined) ?? null
  }

  let conversationId = await findExisting()
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ participant_1: user.id, participant_2: proId, is_support: false })
      .select('id')
      .single()
    if (error?.code === '23505') {
      // Opened concurrently (e.g. double click).
      conversationId = await findExisting()
    } else if (error || !created) {
      if (error?.code === '42501') {
        return { error: "You can't message this professional right now." }
      }
      console.error('[pros] start conversation failed', error?.code)
      return { error: "We couldn't open a conversation. Please try again." }
    } else {
      conversationId = created.id as string
    }
  }
  if (!conversationId) {
    return { error: "We couldn't open a conversation. Please try again." }
  }

  redirect(`/messages/${conversationId}`)
}
