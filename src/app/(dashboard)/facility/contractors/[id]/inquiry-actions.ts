'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { INQUIRY_ERRORS, INQUIRY_KIND_LABEL, inquirySummary } from '@/lib/org/inquiries'

const schema = z.object({
  contractorId: z.string().uuid(),
  kind: z.enum(['inquiry', 'invite']),
  role_title: z.string().trim().min(1, 'Add the role').max(200),
  engagement_type: z.enum(['employee', 'independent_contractor', 'per_diem', 'consulting_project', 'volunteer'], 'Choose the engagement type'),
  timeline: z.enum(['immediately', 'within_month', 'exploring'], 'Choose a timeline'),
  message: z.string().trim().max(2000).default(''),
})

/** An organization sends an inquiry or a team invite to a professional. */
export async function sendOrgInquiry(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' }

  const { error } = await supabase.from('org_inquiries').insert({
    facility_id: user.id,
    contractor_id: d.contractorId,
    kind: d.kind,
    role_title: d.role_title,
    engagement_type: d.engagement_type,
    timeline: d.timeline,
    message: d.message || null,
  })
  if (error) {
    return { ok: false, error: (error.hint && INQUIRY_ERRORS[error.hint]) || 'We couldn’t send that. Please try again.' }
  }

  const { data: org } = await supabase.from('facility_profiles').select('facility_name').eq('id', user.id).single()
  const { error: nErr } = await createAdminClient().from('notifications').insert({
    user_id: d.contractorId,
    type: 'system',
    title: `${INQUIRY_KIND_LABEL[d.kind]} from ${org?.facility_name || 'an organization'}`,
    body: inquirySummary(d),
    data: { href: '/contractor/inquiries' },
  })
  if (nErr) console.error('[inquiries] notification failed', nErr)
  refresh()
  return { ok: true }
}
