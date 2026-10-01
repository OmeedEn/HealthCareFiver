'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { mfaGate } from '@/lib/auth/mfa'
import { isDemoMode } from '@/lib/demo/data'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { ORG_DISCLOSURES, ORG_DOCUMENT_KINDS, facilityTypeEnumFor } from '@/lib/onboarding/organization'
import { STAFFING_POSTS_ENABLED } from '@/lib/onboarding/organization'
import {
  aboutSchema,
  eventSchema,
  fieldErrors,
  intentsSchema,
  lookingForSchema,
  serviceSchema,
  staffingSchema,
  toCents,
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

/** Step 4: save what they want to do, then on to quick setup. */
export async function saveIntents(input: unknown): Promise<ActionResult> {
  const parsed = intentsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (isDemoMode()) return { ok: true }

  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }

  const { data: org } = await a.supabase
    .from('facility_profiles')
    .select('attested_authorized_at')
    .eq('id', a.user.id)
    .single()
  if (!org?.attested_authorized_at) return { ok: false, error: 'Finish verifying your organization first.' }

  const { error } = await a.supabase
    .from('facility_profiles')
    .update({ intents: Array.from(new Set(parsed.data)), onboarding_step: 5 })
    .eq('id', a.user.id)
  if (error) {
    console.error('[onboarding/organization] saveIntents failed', error)
    return { ok: false, error: 'We couldn’t save that. Please try again.' }
  }
  return { ok: true }
}

/* ───────────── Step 5: Quick setup ───────────── */

function invalid(error: z.ZodError): ActionResult {
  return { ok: false, error: 'Please fix the highlighted fields.', fields: fieldErrors(error) }
}

/** A. Advertise services / B. Host events — saved as drafts. */
export async function saveListing(kind: 'service' | 'event', input: unknown): Promise<ActionResult> {
  const a = isDemoMode() ? null : await authed()
  if (a && 'error' in a) return { ok: false, error: a.error as string }

  let row: Record<string, unknown>
  if (kind === 'service') {
    const parsed = serviceSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)
    const d = parsed.data
    row = {
      kind, title: d.title, description: d.description, audiences: d.audiences, format: d.format,
      locations: d.locations || null, contact_for_pricing: d.contact_for_pricing,
      price_cents: d.contact_for_pricing ? null : toCents(d.price), reach_via: d.reach_via,
    }
  } else {
    const parsed = eventSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)
    const d = parsed.data
    row = {
      kind, event_type: d.event_type, title: d.title, description: d.description,
      starts_at: d.date_later ? null : new Date(d.starts_at).toISOString(), format: d.format,
      locations: d.locations || null, capacity: d.capacity ? Number(d.capacity) : null,
      is_free: d.is_free, price_cents: d.is_free ? null : toCents(d.price),
      offers_ceu: d.offers_ceu === 'yes', audiences: d.audiences,
    }
  }
  if (!a) return { ok: true }

  const { error } = await a.supabase.from('org_listings').insert({ ...row, facility_id: a.user.id, status: 'draft' })
  if (error) {
    console.error('[onboarding/organization] saveListing failed', error)
    return { ok: false, error: 'We couldn’t save that. Please try again.' }
  }
  return { ok: true }
}

/** C. Find professionals — the org's "looking for" profile. */
export async function saveLookingFor(input: unknown): Promise<ActionResult> {
  const parsed = lookingForSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  const d = parsed.data
  const lookingFor = {
    ...d,
    specialties: d.specialties.split(',').map((x) => x.trim()).filter(Boolean),
    min_years: d.min_years ? Number(d.min_years) : null,
  }
  const { error } = await a.supabase.from('facility_profiles').update({ looking_for: lookingFor }).eq('id', a.user.id)
  if (error) {
    console.error('[onboarding/organization] saveLookingFor failed', error)
    return { ok: false, error: 'We couldn’t save that. Please try again.' }
  }
  return { ok: true }
}

const JOB_TYPE_FOR: Record<string, string> = {
  employee: 'permanent',
  independent_contractor: 'contract',
  volunteer: 'contract',
}
const PAY_RATE_TYPE_FOR: Record<string, string> = {
  hourly: 'hourly',
  daily: 'daily',
  flat: 'per_contract',
  salary: 'per_contract',
}

/** D. Urgent need / staffing post — saved as a draft job (off until legal review). */
export async function saveStaffingPost(input: unknown): Promise<ActionResult> {
  if (!STAFFING_POSTS_ENABLED) return { ok: false, error: 'Staffing posts aren’t available yet.' }
  const parsed = staffingSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  const d = parsed.data
  const needs = d.needs.map((n) => ({ type: n.type, count: Number(n.count) }))
  const payMin = d.is_volunteer ? null : Number(d.pay_min)
  const payMax = d.is_volunteer || !d.pay_max ? null : Number(d.pay_max)

  const { error } = await a.supabase.from('jobs').insert({
    facility_id: a.user.id,
    status: 'draft',
    title: d.title,
    description: d.description,
    post_type: d.post_type,
    professional_needs: needs,
    positions_available: needs.reduce((n, x) => n + x.count, 0),
    // Legacy NOT NULL columns; the spec fields above are the source of truth.
    contractor_type: 'other',
    job_type: JOB_TYPE_FOR[d.engagement_type],
    shift_type: 'flexible',
    is_ongoing: d.is_ongoing,
    start_date: d.is_ongoing ? null : d.start_date,
    end_date: d.is_ongoing || !d.end_date ? null : d.end_date,
    schedule: d.schedule,
    city: d.city,
    state: d.state,
    zip_code: d.zip_code,
    is_remote: d.is_remote,
    engagement_type: d.engagement_type,
    is_volunteer: d.is_volunteer,
    pay_rate_min: payMin,
    pay_rate_max: payMax,
    hourly_rate_min: payMin,
    hourly_rate_max: payMax,
    pay_unit: d.is_volunteer ? null : d.pay_unit,
    pay_rate_type: d.is_volunteer ? 'hourly' : PAY_RATE_TYPE_FOR[d.pay_unit],
    additional_requirements: d.requirements || null,
    years_experience_min: d.min_years ? Number(d.min_years) : null,
    years_experience_required: d.min_years ? Number(d.min_years) : null,
    screening_questions: d.screening_questions.filter(Boolean),
    application_deadline: d.application_deadline || null,
    urgency: d.is_urgent ? 'high' : 'medium',
    reviewer_emails: d.reviewer_emails.split(/[\s,]+/).filter(Boolean),
    applicant_cap: d.applicant_cap ? Number(d.applicant_cap) : null,
  })
  if (error) {
    console.error('[onboarding/organization] saveStaffingPost failed', error)
    return { ok: false, error: 'We couldn’t save that. Please try again.' }
  }
  return { ok: true }
}

/** Finish: submit the application for review. */
export async function finishOnboarding(): Promise<ActionResult> {
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }

  const { data: org } = await a.supabase
    .from('facility_profiles')
    .select('onboarding_submitted_at, attested_authorized_at, intents')
    .eq('id', a.user.id)
    .single()
  if (!org?.attested_authorized_at || !(org.intents ?? []).length) {
    return { ok: false, error: 'Finish the earlier steps first.' }
  }
  const { error } = await a.supabase
    .from('facility_profiles')
    .update({ onboarding_step: 5, onboarding_submitted_at: org.onboarding_submitted_at ?? new Date().toISOString() })
    .eq('id', a.user.id)
  if (error) {
    console.error('[onboarding/organization] finishOnboarding failed', error)
    return { ok: false, error: 'We couldn’t submit your application. Please try again.' }
  }
  return { ok: true }
}
