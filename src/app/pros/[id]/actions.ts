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

type Opened = { conversationId: string; userId: string } | { error: string }

/**
 * Open (or reuse) a direct conversation with a live professional. Runs with
 * the caller's own session so RLS gates still apply.
 */
async function openConversation(proId: string): Promise<Opened> {
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
  const pro = await getPublicProfile(proId, null, { details: false })
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
  return { conversationId, userId: user.id }
}

/** "Message" on a profile: open (or reuse) the conversation and go to it. */
export async function startConversation(
  proId: string,
  _prev: StartConversationState,
  _form: FormData
): Promise<StartConversationState> {
  const opened = await openConversation(proId)
  if ('error' in opened) return { error: opened.error }
  redirect(`/messages/${opened.conversationId}`)
}

const bookingSchema = z.object({
  service: z.string().trim().max(200),
  format: z.enum(['', 'virtual', 'in_person', 'home_visit']),
  when: z.string().trim().max(200),
  note: z.string().trim().max(2000),
})

const FORMAT_LABEL: Record<string, string> = {
  virtual: 'Video visit',
  in_person: 'In person',
  home_visit: 'At my home',
}

const field = (form: FormData, key: string) => {
  const v = form.get(key)
  return typeof v === 'string' ? v : ''
}

/**
 * "Request booking" (clients): sends a structured booking request as a
 * message in the conversation with the professional, then goes to it. The
 * professional confirms the time there.
 */
export async function requestProBooking(
  proId: string,
  _prev: StartConversationState,
  form: FormData
): Promise<StartConversationState> {
  const parsed = bookingSchema.safeParse({
    service: field(form, 'service'),
    format: field(form, 'format'),
    when: field(form, 'when'),
    note: field(form, 'note'),
  })
  if (!parsed.success) return { error: 'Please check your answers and try again.' }
  const d = parsed.data
  if (!d.service && !d.note) {
    return { error: 'Tell them what you need: pick a service or add a note.' }
  }

  const opened = await openConversation(proId)
  if ('error' in opened) return { error: opened.error }

  const content = [
    'Booking request',
    d.service && `Service: ${d.service}`,
    d.format && `Format: ${FORMAT_LABEL[d.format]}`,
    d.when && `Preferred time: ${d.when}`,
    d.note && `\n${d.note}`,
  ]
    .filter(Boolean)
    .join('\n')

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    conversation_id: opened.conversationId,
    sender_id: opened.userId,
    content,
  })
  if (error) {
    console.error('[pros] booking request message failed', error.code)
    return { error: "We couldn't send your request. Please try again." }
  }
  redirect(`/messages/${opened.conversationId}`)
}
