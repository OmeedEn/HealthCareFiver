'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { mfaGate } from '@/lib/auth/mfa'
import { isDemoMode } from '@/lib/demo/data'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { ORG_DISCLOSURES, ORG_DOCUMENT_KINDS, facilityTypeEnumFor } from '@/lib/onboarding/organization'
import {
  aboutSchema,
  fieldErrors,
  intentsSchema,
  verifySchema,
  type OrgDoc,
} from './shared'

export type ActionResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> }

const SESSION_EXPIRED = 'Your session expired. Please sign in again.'

async function authed() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: SESSION_EXPIRED } as const
  if ((await mfaGate(supabase)) !== 'ok') return { error: SESSION_EXPIRED } as const
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'facility' && profile?.role !== 'staffing_agency') {
    return { error: 'Only organization accounts can do this.' } as const
  }
  return { user, supabase } as const
}

async function bumpStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  next: number
) {
  const { data } = await supabase.from('facility_profiles').select('onboarding_step').eq('id', userId).single()
  return Math.max(Number(data?.onboarding_step ?? 2), next)
}

/** Step 2. */
export async function saveAbout(input: unknown): Promise<ActionResult> {
  const parsed = aboutSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fields: fieldErrors(parsed.error) }
  }
  const phone = normalizeUsPhone(parsed.data.phone)
  if (!phone) return { ok: false, error: 'Please fix the highlighted fields.', fields: { phone: `${PHONE_ERROR}.` } }
  if (isDemoMode()) return { ok: true }

  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  const d = parsed.data
  const website = /^https?:\/\//i.test(d.website) ? d.website : `https://${d.website}`

  const { error } = await a.supabase
    .from('facility_profiles')
    .update({
      facility_name: d.facility_name,
      org_type: d.org_type,
      org_type_other: d.org_type === 'other' ? d.org_type_other : null,
      facility_type: facilityTypeEnumFor(d.org_type),
      org_size: d.org_size,
      city: d.city,
      state: d.state,
      zip_code: d.zip_code,
      location_count: d.location_count,
      website,
      phone,
      description: d.description,
      onboarding_step: await bumpStep(a.supabase, a.user.id, 3),
    })
    .eq('id', a.user.id)
  if (error) {
    console.error('[onboarding/organization] saveAbout failed', error)
    return { ok: false, error: 'We couldn’t save that. Please try again.' }
  }
  return { ok: true }
}

const recordDocSchema = z.object({
  kind: z.enum(ORG_DOCUMENT_KINDS.map((k) => k.kind) as [string, ...string[]]),
  path: z.string().min(1).max(1024),
  filename: z.string().min(1).max(255),
})

/** Step 3 upload: record a file the browser already put in storage. */
export async function recordOrgDocument(
  input: unknown
): Promise<{ ok: true; doc: OrgDoc } | { ok: false; error: string }> {
  const parsed = recordDocSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid upload.' }
  const { kind, path, filename } = parsed.data
  if (isDemoMode()) {
    return { ok: true, doc: { id: `demo-${kind}-${Date.now()}`, kind: kind as OrgDoc['kind'], filename, storage_path: path } }
  }

  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  // Must be the caller's own folder (storage RLS enforces the upload side).
  if (!path.startsWith(`${a.user.id}/org/`) || path.includes('..')) return { ok: false, error: 'Invalid upload.' }

  const { data, error } = await a.supabase
    .from('org_documents')
    .insert({ facility_id: a.user.id, kind, storage_path: path, filename })
    .select('id, kind, filename, storage_path')
    .single()
  if (error || !data) return { ok: false, error: 'We couldn’t save that document. Please try again.' }
  return { ok: true, doc: data as OrgDoc }
}

export async function removeOrgDocument(id: string): Promise<ActionResult> {
  if (!z.string().min(1).max(100).safeParse(id).success) return { ok: false, error: 'Invalid document.' }
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  const { error } = await a.supabase.from('org_documents').delete().eq('id', id).eq('facility_id', a.user.id)
  if (error) return { ok: false, error: 'We couldn’t remove that document.' }
  return { ok: true }
}

/** Step 3. */
export async function saveVerification(input: unknown): Promise<ActionResult> {
  const parsed = verifySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Please fix the highlighted fields.', fields: fieldErrors(parsed.error) }
  }
  if (isDemoMode()) return { ok: true }

  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  const d = parsed.data
  const hasLicense = d.has_facility_license === 'yes'

  const { data: docs } = await a.supabase.from('org_documents').select('kind').eq('facility_id', a.user.id)
  const kinds = new Set((docs ?? []).map((x) => x.kind))
  const docErrors: Record<string, string> = {}
  if (!kinds.has('business_registration')) {
    docErrors['doc.business_registration'] = 'Upload your business license or Secretary of State registration'
  }
  if (hasLicense && !kinds.has('facility_license')) {
    docErrors['doc.facility_license'] = 'Upload your facility license'
  }
  if (Object.keys(docErrors).length) {
    return { ok: false, error: 'Please upload the required documents.', fields: docErrors }
  }

  const disclosures = Object.fromEntries(
    ORG_DISCLOSURES.map((q) => {
      const ans = d.disclosures[q.key]
      return [q.key, { answer: ans.answer === 'yes', details: ans.answer === 'yes' ? ans.details : null }]
    })
  )
  const now = new Date().toISOString()

  const { error } = await a.supabase
    .from('facility_profiles')
    .update({
      legal_name: d.legal_name || null,
      business_structure: d.business_structure,
      registration_state: d.registration_state,
      has_facility_license: hasLicense,
      facility_license_type: hasLicense ? d.facility_license_type : null,
      facility_license_number: hasLicense ? d.facility_license_number : null,
      facility_license_agency: hasLicense ? d.facility_license_agency : null,
      facility_license_expires: hasLicense ? d.facility_license_expires : null,
      org_npi: d.org_npi || null,
      self_disclosures: disclosures,
      attested_authorized_at: now,
      authorized_checks_at: now,
      onboarding_step: await bumpStep(a.supabase, a.user.id, 4),
    })
    .eq('id', a.user.id)
  if (error) {
    console.error('[onboarding/organization] saveVerification failed', error)
    return { ok: false, error: 'We couldn’t save that. Please try again.' }
  }
  return { ok: true }
}

/** Step 4: save intents and submit the application for review. */
export async function submitIntents(input: unknown): Promise<ActionResult> {
  const parsed = intentsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (isDemoMode()) return { ok: true }

  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }

  const { data: org } = await a.supabase
    .from('facility_profiles')
    .select('onboarding_step, onboarding_submitted_at, attested_authorized_at')
    .eq('id', a.user.id)
    .single()
  if (!org?.attested_authorized_at) return { ok: false, error: 'Finish verifying your organization first.' }

  const { error } = await a.supabase
    .from('facility_profiles')
    .update({
      intents: Array.from(new Set(parsed.data)),
      onboarding_step: 5,
      onboarding_submitted_at: org.onboarding_submitted_at ?? new Date().toISOString(),
    })
    .eq('id', a.user.id)
  if (error) {
    console.error('[onboarding/organization] submitIntents failed', error)
    return { ok: false, error: 'We couldn’t submit your application. Please try again.' }
  }
  return { ok: true }
}
