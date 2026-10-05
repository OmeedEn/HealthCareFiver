'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { INQUIRY_KIND_LABEL, inquirySummary, type InquiryKind } from '@/lib/org/inquiries'

/**
 * A professional accepts or declines an inquiry. Accepting opens a
 * conversation with the organization, seeded with the inquiry details.
 */
export async function respondToInquiry(id: string, accept: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid inquiry.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' }

  const { data: inq } = await supabase
    .from('org_inquiries')
    .select('id, facility_id, contractor_id, kind, role_title, engagement_type, timeline, message, status')
    .eq('id', id)
    .eq('contractor_id', user.id)
    .single()
  if (!inq || inq.status !== 'sent') return { ok: false, error: 'This inquiry was already answered.' }

  let conversationId: string | null = null
  if (accept) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${inq.facility_id}),and(participant_1.eq.${inq.facility_id},participant_2.eq.${user.id})`)
      .maybeSingle()
    conversationId = existing?.id ?? null
    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({ participant_1: inq.facility_id, participant_2: user.id })
        .select('id')
        .single()
      if (error || !conv) return { ok: false, error: 'We couldn’t open a conversation. Please try again.' }
      conversationId = conv.id
    }
    const detail = `${INQUIRY_KIND_LABEL[inq.kind as InquiryKind]}: ${inquirySummary(inq)}${inq.message ? `\n\n“${inq.message}”` : ''}`
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: `I accepted your ${inq.kind === 'invite' ? 'invitation' : 'inquiry'}.\n\n${detail}`,
      is_system_message: true,
    })
  }

  const { error } = await supabase
    .from('org_inquiries')
    .update({ status: accept ? 'accepted' : 'declined', conversation_id: conversationId })
    .eq('id', id)
  if (error) return { ok: false, error: 'We couldn’t save your response.' }

  const { data: pro } = await supabase.from('contractor_profiles').select('first_name, last_name').eq('id', user.id).single()
  const name = [pro?.first_name, pro?.last_name].filter(Boolean).join(' ') || 'A professional'
  const { error: nErr } = await createAdminClient().from('notifications').insert({
    user_id: inq.facility_id,
    type: 'system',
    title: `${name} ${accept ? 'accepted' : 'declined'} your ${inq.kind === 'invite' ? 'invitation' : 'inquiry'}`,
    body: inquirySummary(inq),
    data: { href: accept && conversationId ? `/messages/${conversationId}` : `/facility/contractors/${user.id}` },
  })
  if (nErr) console.error('[inquiries] notification failed', nErr)
  refresh()
  return { ok: true }
}

/** Turn inquiries from organizations on or off. */
export async function setAcceptsInquiries(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' }
  const { error } = await supabase.from('contractor_profiles').update({ accepts_inquiries: on }).eq('id', user.id)
  if (error) return { ok: false, error: 'We couldn’t save that.' }
  refresh()
  return { ok: true }
}
