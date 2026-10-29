'use server'

import { z } from 'zod'
import { refresh } from 'next/cache'
import { blockedClaimsMessage, findBlockedClaims } from '@/lib/listings/claims'
import { createClient } from '@/lib/supabase/server'
import { mfaGate } from '@/lib/auth/mfa'
import { isDemoMode } from '@/lib/demo/data'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import {
  ORG_DOCUMENT_KINDS,
  ORG_INTENT_KEYS,
  STAFFING_POSTS_ENABLED,
  facilityTypeEnumFor,
} from '@/lib/onboarding/organization'
import { markSubmitted, recordProgress } from '@/lib/onboarding/progress'
import { ORG_FLOW_IDS, orgAnswerOnFile, orgFlowDataFromRow } from '@/lib/onboarding/questions/organization'
import { disclosureKeysFor } from '@/lib/onboarding/checklist-organization'
import { orgMustVerify } from '@/lib/onboarding/org-verify-later-server'
import {
  checkFields,
  eventSchema,
  fieldErrors,
  isOrgTypeAllowed,
  lookingForSchema,
  orgDoorFor,
  orgFieldRules,
  ORG_TYPE_NOT_OFFERED,
  serviceSchema,
  staffingSchema,
  toCents,
  withScheme,
  type OrgDoc,
  type OrgFieldInput,
  type OrgFieldKey,
} from './shared'

export type ActionResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> }

const SESSION_EXPIRED = 'Your session expired. Please sign in again.'
const FIX_FIELDS = 'Please fix the highlighted fields.'
const SAVE_FAILED = 'We couldn’t save that. Please try again.'

async function authed() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: SESSION_EXPIRED } as const
  if ((await mfaGate(supabase)) !== 'ok') return { error: SESSION_EXPIRED } as const
  const { data: profile } = await supabase.from('profiles').select('role, signup_path').eq('id', user.id).single()
  if (profile?.role !== 'facility' && profile?.role !== 'staffing_agency') {
    return { error: 'Only organization accounts can do this.' } as const
  }
  return { user, supabase, door: orgDoorFor(profile.signup_path) } as const
}

/** Demo mode has no stored door; it behaves like Hiring (both type lists, facility license). */
const DEMO_DOOR = 'HIRING' as const

/** Question ids the flow and the dashboard items record (onboarding_progress, flow 'organization'). */
const QUESTION_ID = z.string().regex(/^[a-z_]{1,40}$/)

const blankToNull = (v: string) => (v === '' ? null : v)

/**
 * Save one screen's answers (onboarding screens 1–2 and 4–6, and the
 * dashboard's Finish your profile items). Only the fields given are
 * checked and written; `answered` marks the question ids done in
 * onboarding_progress so a refresh resumes after them.
 */
export async function saveOrgFields(input: OrgFieldInput, answered: string[] = []): Promise<ActionResult> {
  const data = (input ?? {}) as Record<string, unknown>
  const keys = Object.keys(data).filter((k): k is OrgFieldKey => k in orgFieldRules)
  if (!z.array(QUESTION_ID).max(10).safeParse(answered).success) return { ok: false, error: 'Invalid question.' }
  const fields = checkFields(orgFieldRules, keys, data)
  if (data.org_type === 'other' && !String(data.org_type_other ?? '').trim()) {
    fields.org_type_other = 'Tell us what kind of organization you are'
  }
  if (Object.keys(fields).length) return { ok: false, error: FIX_FIELDS, fields }
  const d = z.object(orgFieldRules).partial().parse(data)

  const update: Record<string, unknown> = {}
  for (const k of keys) {
    const v = d[k]
    switch (k) {
      case 'org_type':
        update.org_type = v
        update.facility_type = facilityTypeEnumFor(d.org_type!)
        update.org_type_other = d.org_type === 'other' ? d.org_type_other || null : null
        break
      case 'org_type_other':
        if (!keys.includes('org_type')) update.org_type_other = blankToNull(d.org_type_other ?? '')
        break
      case 'website':
        update.website = d.website ? withScheme(d.website) : null
        break
      case 'lead_linkedin':
        update.lead_linkedin = d.lead_linkedin ? withScheme(d.lead_linkedin) : null
        break
      case 'has_facility_license':
      case 'lead_has_credential':
        update[k] = v === 'yes'
        break
      case 'phone': {
        if (!d.phone) {
          update.phone = null
          break
        }
        const phone = normalizeUsPhone(d.phone)
        if (!phone) return { ok: false, error: FIX_FIELDS, fields: { phone: `${PHONE_ERROR}.` } }
        update.phone = phone
        break
      }
      case 'location_count':
        update.location_count = d.location_count ? Number(d.location_count) : null
        break
      case 'disclosures':
        break // merged below, needs the saved row
      default:
        update[k] = typeof v === 'string' ? blankToNull(v) : v
    }
  }
  // A "no" on screen 6 clears the details it would have asked for.
  if (update.has_facility_license === false) {
    Object.assign(update, {
      facility_license_type: null,
      facility_license_number: null,
      facility_license_agency: null,
      facility_license_expires: null,
    })
  }
  if (update.lead_has_credential === false) {
    Object.assign(update, { lead_credential_type: null, lead_credential_number: null, lead_credential_state: null })
  }
  // Typing a website un-declares "We don't have a website", and vice versa.
  if (typeof update.website === 'string' && !keys.includes('has_no_website')) update.has_no_website = false
  if (update.has_no_website === true) update.website = null

  if (isDemoMode()) {
    return d.org_type && !isOrgTypeAllowed(DEMO_DOOR, d.org_type)
      ? { ok: false, error: FIX_FIELDS, fields: { org_type: ORG_TYPE_NOT_OFFERED } }
      : { ok: true }
  }

  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  // The type list depends on the door; trust the stored door, not the client.
  if (d.org_type && !isOrgTypeAllowed(a.door, d.org_type)) {
    return { ok: false, error: FIX_FIELDS, fields: { org_type: ORG_TYPE_NOT_OFFERED } }
  }

  if (d.disclosures) {
    const { data: org } = await a.supabase
      .rpc('my_facility_profile')
      .select('self_disclosures, has_facility_license')
      .single<{ self_disclosures: Record<string, unknown> | null; has_facility_license: boolean | null }>()
    const asked = disclosureKeysFor({ has_facility_license: org?.has_facility_license ?? null })
    const picked = d.disclosures.picked.filter((k) => (asked as readonly string[]).includes(k))
    if (picked.length && !d.disclosures.details) {
      return { ok: false, error: FIX_FIELDS, fields: { 'disclosures.details': 'Tell us a bit more' } }
    }
    const merged: Record<string, unknown> = { ...(org?.self_disclosures ?? {}) }
    for (const k of asked) {
      const yes = picked.includes(k)
      merged[k] = { answer: yes, details: yes ? d.disclosures.details : null }
    }
    update.self_disclosures = merged
  }

  if (Object.keys(update).length) {
    const { error } = await a.supabase.from('facility_profiles').update(update).eq('id', a.user.id)
    if (error) {
      console.error('[onboarding/organization] saveOrgFields failed', { code: error.code, keys })
      return { ok: false, error: SAVE_FAILED }
    }
  }
  if (answered.length) {
    const res = await recordProgress(a.supabase, a.user.id, 'organization', { answered })
    if (!res.ok) return res
  }
  return { ok: true }
}

/** "Skip for now": the question becomes a Finish your profile item. */
export async function skipOrgQuestion(id: string): Promise<ActionResult> {
  if (!QUESTION_ID.safeParse(id).success) return { ok: false, error: 'Invalid question.' }
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  return recordProgress(a.supabase, a.user.id, 'organization', { skipped: [id] })
}

/** Mark questions answered without changing any profile field (e.g. an upload screen, or "same as our name"). */
export async function markOrgAnswered(ids: string[]): Promise<ActionResult> {
  if (!z.array(QUESTION_ID).min(1).max(10).safeParse(ids).success) return { ok: false, error: 'Invalid question.' }
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  return recordProgress(a.supabase, a.user.id, 'organization', { answered: ids })
}

const recordDocSchema = z.object({
  kind: z.enum(ORG_DOCUMENT_KINDS.map((k) => k.kind) as [string, ...string[]]),
  path: z.string().min(1).max(1024),
  filename: z.string().min(1).max(255),
})

/** Record a file the browser already put in storage. */
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

const submitSchema = z.object({
  attest_authorized: z.literal(true, 'Please confirm you’re authorized and the information is accurate'),
  attest_checks: z.literal(true, 'Please authorize verification and exclusion screenings'),
})

/**
 * Screen 8: record both attestations and submit the application for review.
 * Needs the answers screens 1–6 ask; the registration upload is skippable
 * (a Needed for approval item if skipped), and disclosures and the rest
 * are dashboard items. Skipping never blocks submission.
 */
export async function submitOrgApplication(input: unknown): Promise<ActionResult> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: FIX_FIELDS, fields: fieldErrors(parsed.error) }
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }

  const [{ data: org }, { data: docs }] = await Promise.all([
    a.supabase.rpc('my_facility_profile').select('*').single<Record<string, unknown>>(),
    a.supabase.from('org_documents').select('kind').eq('facility_id', a.user.id),
  ])
  if (!org) return { ok: false, error: 'We couldn’t find your organization. Please refresh and try again.' }
  const flow = orgFlowDataFromRow(org, (docs ?? []).map((x) => x.kind as string))
  const open = ORG_FLOW_IDS.filter(
    (id) => id !== 'registration_doc' && id !== 'submit' && !orgAnswerOnFile(id, flow, a.door)
  )
  if (open.length) return { ok: false, error: 'A few earlier questions still need an answer. Go back to finish them.' }

  const now = new Date().toISOString()
  const { error } = await a.supabase
    .from('facility_profiles')
    .update({
      attested_authorized_at: now,
      authorized_checks_at: now,
      onboarding_step: 5,
      onboarding_submitted_at: (org.onboarding_submitted_at as string | null) ?? now,
    })
    .eq('id', a.user.id)
  if (error) {
    console.error('[onboarding/organization] submit failed', { code: error.code })
    return { ok: false, error: 'We couldn’t submit your application. Please try again.' }
  }
  const progress = await recordProgress(a.supabase, a.user.id, 'organization', { answered: ['submit'] })
  if (!progress.ok) return progress
  return markSubmitted(a.supabase, a.user.id, 'organization')
}

/**
 * A "What do you want to do first?" card was opened: remember the intent
 * (shapes suggestions; editable on the profile page).
 */
export async function recordOrgIntent(intent: string): Promise<ActionResult> {
  const parsed = z.enum(ORG_INTENT_KEYS).safeParse(intent)
  if (!parsed.success) return { ok: false, error: 'Unknown option.' }
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return { ok: false, error: a.error as string }
  const { data: org } = await a.supabase.rpc('my_facility_profile').select('intents').single<{ intents: string[] | null }>()
  const intents = Array.from(new Set([...(org?.intents ?? []), parsed.data]))
  const { error } = await a.supabase.from('facility_profiles').update({ intents }).eq('id', a.user.id)
  if (error) return { ok: false, error: SAVE_FAILED }
  refresh()
  return { ok: true }
}

/* ───────────── Setup from the first-run cards (drafts) ───────────── */

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
  const claims = findBlockedClaims(row.title as string, row.description as string)
  if (claims.length) {
    return { ok: false, error: blockedClaimsMessage(claims), fields: { description: blockedClaimsMessage(claims) } }
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
  // Hiring orgs verify later: posting needs a submitted organization.
  if (await orgMustVerify(a.supabase, a.user.id)) {
    return { ok: false, error: 'Verify your organization before posting. It takes about two minutes.' }
  }
  const d = parsed.data
  const needs =d.needs.map((n) => ({ type: n.type, count: Number(n.count) }))
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

