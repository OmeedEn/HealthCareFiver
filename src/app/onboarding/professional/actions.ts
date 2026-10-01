'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentUser, requireRole, type SessionUser } from '@/lib/auth/roles'
import { isDemoMode } from '@/lib/demo/data'
import { CREDENTIALS_BUCKET } from '@/lib/credentials/document'
import { submitContractorForReview } from '@/lib/verification/submit-for-review'
import {
  credentialsSchemas,
  docSlotsFor,
  firstErrors,
  normalizeWebsiteUrl,
  offeringSchema,
  type ActionResult,
  type DocSlotKey,
  type ProCategory,
  type UploadedDoc,
} from './shared'

/*
 * Server actions for /onboarding/professional. Every action:
 *   - authenticates with currentUser() (enforces MFA/AAL2 when enabled) and
 *     requireRole('contractor');
 *   - only ever reads/writes rows owned by that user (contractor_profiles.id,
 *     credentials.contractor_id and professional_offerings.contractor_id are
 *     all = auth.uid());
 *   - is a no-op in demo mode (no Supabase configured).
 */

type Supa = Awaited<ReturnType<typeof createClient>>

const CATEGORIES = ['clinical', 'allied', 'consultant', 'educator'] as const
const categorySchema = z.enum(CATEGORIES)

// Credentials a contractor may withdraw during onboarding. Never verified ones.
const REMOVABLE_CREDENTIAL_STATUSES = ['pending_upload', 'pending_review', 'rejected']

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'

async function authed(): Promise<
  { user: SessionUser; supabase: Supa } | { error: ActionResult }
> {
  let user: SessionUser
  try {
    user = requireRole(await currentUser(), 'contractor')
  } catch {
    return { error: { ok: false, error: SESSION_EXPIRED } }
  }
  return { user, supabase: await createClient() }
}

async function loadCategory(
  supabase: Supa,
  userId: string
): Promise<{ category: ProCategory | null; step: number; completed: boolean; specialties: string[] } | null> {
  const { data, error } = await supabase
    .from('contractor_profiles')
    .select('professional_category, onboarding_step, onboarding_completed_at, specialties')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  const parsed = categorySchema.safeParse(data.professional_category)
  return {
    category: parsed.success ? parsed.data : null,
    step: Number(data.onboarding_step ?? 2),
    completed: !!data.onboarding_completed_at,
    specialties: Array.isArray(data.specialties) ? data.specialties : [],
  }
}

const GENERIC_ERROR: ActionResult = {
  ok: false,
  error: 'Something went wrong saving your progress. Please try again.',
}

/* ───────────── Step 2 ───────────── */

export async function saveCategory(category: string): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(category)
  if (!parsed.success) return { ok: false, error: 'Choose a category.' }
  if (isDemoMode()) return { ok: true }

  const a = await authed()
  if ('error' in a) return a.error

  const { error } = await a.supabase
    .from('contractor_profiles')
    .update({ professional_category: parsed.data, onboarding_step: 3 })
    .eq('id', a.user.id)
  if (error) return GENERIC_ERROR
  return { ok: true }
}

/* ───────────── Step 3 ───────────── */

export async function saveCredentialDetails(
  input: Record<string, unknown>
): Promise<ActionResult> {
  // In demo mode there's no stored category; validate against the one sent.
  if (isDemoMode()) {
    const c = categorySchema.safeParse(input.category)
    if (!c.success) return { ok: false, error: 'Choose a category first.' }
    const r = credentialsSchemas[c.data].safeParse(input)
    if (!r.success) {
      return {
        ok: false,
        error: 'Please fix the highlighted fields.',
        fieldErrors: firstErrors(r.error.issues),
      }
    }
    return { ok: true }
  }

  const a = await authed()
  if ('error' in a) return a.error
  const { user, supabase } = a

  // Branch on the STORED category, never on what the client claims.
  const profile = await loadCategory(supabase, user.id)
  if (!profile) return GENERIC_ERROR
  if (!profile.category) return { ok: false, error: 'Choose a category first.' }
  const category = profile.category

  const withSpecialty = (s: string) => [
    s,
    ...profile.specialties.filter((x) => x !== s),
  ]

  let update: Record<string, unknown>
  if (category === 'clinical') {
    const r = credentialsSchemas.clinical.safeParse(input)
    if (!r.success) return invalid(r.error.issues)
    const v = r.data
    const states = [...new Set(v.license_states)]
    update = {
      license_type: v.license_type,
      specialties: withSpecialty(v.specialty),
      state_license_number: v.state_license_number,
      license_states: states,
      license_state: states[0],
      npi_number: v.npi_number || null,
      years_of_experience: v.years_of_experience,
    }
  } else if (category === 'allied') {
    const r = credentialsSchemas.allied.safeParse(input)
    if (!r.success) return invalid(r.error.issues)
    const v = r.data
    update = {
      certification_type: v.certification_type,
      certifying_organization: v.certifying_organization,
      certification_number: v.certification_number,
      specialties: withSpecialty(v.specialty),
      years_of_experience: v.years_of_experience,
    }
  } else if (category === 'consultant') {
    const r = credentialsSchemas.consultant.safeParse(input)
    if (!r.success) return invalid(r.error.issues)
    const v = r.data
    update = {
      specialties: withSpecialty(v.specialty),
      consulting_background: v.consulting_background,
      client_types: [...new Set(v.client_types)],
      years_of_experience: v.years_of_experience,
      website_url: normalizeWebsiteUrl(v.website_url),
    }
  } else {
    const r = credentialsSchemas.educator.safeParse(input)
    if (!r.success) return invalid(r.error.issues)
    const v = r.data
    update = {
      primary_background: v.primary_background,
      teaching_topics: v.teaching_topics,
      client_types: [...new Set(v.client_types)],
      ceu_accreditation: v.ceu_accreditation,
    }
  }

  const { error } = await supabase
    .from('contractor_profiles')
    .update({ ...update, onboarding_step: Math.max(4, Math.min(profile.step, 5)) })
    .eq('id', user.id)
  if (error) return GENERIC_ERROR
  return { ok: true }
}

function invalid(issues: { path: PropertyKey[]; message: string }[]): ActionResult {
  return {
    ok: false,
    error: 'Please fix the highlighted fields.',
    fieldErrors: firstErrors(issues),
  }
}

/* ───────────── Step 4 ───────────── */

const recordDocSchema = z.object({
  slot: z.enum(['license', 'malpractice', 'resume', 'government_id']),
  path: z.string().min(3).max(500),
  filename: z.string().trim().min(1).max(255),
  replaceId: z.string().uuid().nullable(),
})

export type RecordDocumentResult =
  | { ok: true; doc: UploadedDoc }
  | { ok: false; error: string }

/**
 * Record a document the browser already uploaded to the private credentials
 * bucket at `{user_id}/…`. Inserts a pending_review credentials row holding
 * the storage PATH; with replaceId, withdraws the previous upload afterwards.
 */
export async function recordDocument(input: {
  slot: DocSlotKey
  path: string
  filename: string
  replaceId: string | null
}): Promise<RecordDocumentResult> {
  const parsed = recordDocSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid upload.' }
  const { slot: slotKey, path, filename, replaceId } = parsed.data

  if (isDemoMode()) {
    return {
      ok: true,
      doc: {
        id: `demo-${slotKey}-${Date.now()}`,
        credential_type: slotKey,
        name: filename,
        document_filename: filename,
        document_url: path,
        status: 'pending_review',
      },
    }
  }

  const a = await authed()
  if ('error' in a) return { ok: false, error: SESSION_EXPIRED }
  const { user, supabase } = a

  // The object must live in the caller's own folder (storage RLS enforces the
  // upload side; this stops a row pointing at someone else's file).
  if (!path.startsWith(`${user.id}/`) || path.includes('..')) {
    return { ok: false, error: 'Invalid upload.' }
  }

  const profile = await loadCategory(supabase, user.id)
  if (!profile?.category) return { ok: false, error: 'Choose a category first.' }
  const slot = docSlotsFor(profile.category).find((s) => s.key === slotKey)
  if (!slot) return { ok: false, error: 'That document is not needed for your category.' }

  const { data, error } = await supabase
    .from('credentials')
    .insert({
      contractor_id: user.id,
      credential_type: slot.credentialType,
      name: slot.label,
      status: 'pending_review',
      document_url: path,
      document_filename: filename,
    })
    .select('id, credential_type, name, document_filename, document_url, status')
    .single()

  if (error || !data) {
    return { ok: false, error: "We couldn't save that document. Please try again." }
  }

  if (replaceId) await withdrawCredential(user.id, replaceId)

  return { ok: true, doc: data as UploadedDoc }
}

export async function removeDocument(credentialId: string): Promise<ActionResult> {
  if (!z.string().min(1).max(100).safeParse(credentialId).success) {
    return { ok: false, error: 'Invalid document.' }
  }
  if (isDemoMode()) return { ok: true }

  const a = await authed()
  if ('error' in a) return a.error
  if (!z.string().uuid().safeParse(credentialId).success) {
    return { ok: false, error: 'Invalid document.' }
  }

  const removed = await withdrawCredential(a.user.id, credentialId)
  return removed
    ? { ok: true }
    : { ok: false, error: "We couldn't remove that document. Please try again." }
}

/**
 * Delete one of the caller's own not-yet-verified credentials and its stored
 * object. There is no owner DELETE policy on `credentials` or on the storage
 * bucket, so this uses the service role — scoped by contractor_id = caller
 * and to the caller's own `{user_id}/` folder.
 */
async function withdrawCredential(userId: string, credentialId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('credentials')
    .delete()
    .eq('id', credentialId)
    .eq('contractor_id', userId)
    .in('status', REMOVABLE_CREDENTIAL_STATUSES)
    .select('document_url')
    .maybeSingle()
  if (error || !data) return false

  const path = typeof data.document_url === 'string' ? data.document_url : null
  if (path && path.startsWith(`${userId}/`) && !/^https?:/i.test(path)) {
    const { error: rmError } = await admin.storage
      .from(CREDENTIALS_BUCKET)
      .remove([path])
    if (rmError) console.error('onboarding: failed to remove credential object', rmError.message)
  }
  return true
}

/**
 * Step 4 → 5. Requires every required document for the stored category, then
 * submits the contractor for review (not_submitted / more_info_requested →
 * pending_review) — the same logic as POST /api/contractor/verification/resubmit.
 */
export async function submitDocuments(): Promise<ActionResult> {
  if (isDemoMode()) return { ok: true }

  const a = await authed()
  if ('error' in a) return a.error
  const { user, supabase } = a

  const profile = await loadCategory(supabase, user.id)
  if (!profile) return GENERIC_ERROR
  if (!profile.category) return { ok: false, error: 'Choose a category first.' }

  const { data: creds, error } = await supabase
    .from('credentials')
    .select('credential_type, document_url, status')
    .eq('contractor_id', user.id)
  if (error) return GENERIC_ERROR

  const have = new Set(
    (creds ?? [])
      .filter((c) => c.document_url && c.status !== 'rejected')
      .map((c) => String(c.credential_type))
  )
  const missing = docSlotsFor(profile.category).filter(
    (s) => s.required && !s.matches.some((t) => have.has(t))
  )
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Please upload: ${missing.map((m) => m.label).join(', ')}.`,
    }
  }

  const submitted = await submitContractorForReview(user.id)
  if (!submitted.ok) return GENERIC_ERROR

  const { error: stepError } = await supabase
    .from('contractor_profiles')
    .update({ onboarding_step: 5 })
    .eq('id', user.id)
  if (stepError) return GENERIC_ERROR
  return { ok: true }
}

/* ───────────── Step 5 ───────────── */

export async function saveOfferings(input: unknown[]): Promise<ActionResult> {
  const list = z.array(z.unknown()).min(1).max(30).safeParse(input)
  if (!list.success) {
    return { ok: false, error: 'Add at least one offering, or skip for now.' }
  }

  const rows: Record<string, unknown>[] = []
  const fieldErrors: Record<string, string> = {}
  list.data.forEach((raw, i) => {
    const r = offeringSchema.safeParse(raw)
    if (!r.success) {
      for (const [k, msg] of Object.entries(firstErrors(r.error.issues))) {
        fieldErrors[`${i}.${k}`] = msg
      }
      return
    }
    const v = r.data
    if (v.kind === 'service') {
      rows.push({
        kind: 'service',
        title: v.title,
        description: v.description || null,
        format: v.format,
        duration_minutes: v.duration_minutes,
        price_cents: v.price,
        is_free: false,
      })
    } else if (v.kind === 'consulting') {
      rows.push({
        kind: 'consulting',
        title: v.title,
        description: v.description || null,
        engagement_type: v.engagement_type,
        custom_quote: v.custom_quote,
        price_cents: v.custom_quote ? null : Math.round(Number(v.price) * 100),
        is_free: false,
      })
    } else {
      rows.push({
        kind: 'event',
        event_type: v.event_type,
        title: v.title,
        description: v.description || null,
        starts_at: v.date_later ? null : new Date(v.starts_at).toISOString(),
        capacity: v.capacity ? Number(v.capacity) : null,
        is_free: v.is_free,
        price_cents: v.is_free ? 0 : Math.round(Number(v.price) * 100),
      })
    }
  })

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors }
  }
  if (isDemoMode()) return { ok: true }

  const a = await authed()
  if ('error' in a) return a.error
  const { user, supabase } = a

  const gate = await requireStep5(supabase, user.id)
  if (gate) return gate

  // Onboarding owns only the contractor's DRAFT rows; replace them wholesale
  // so re-submitting never duplicates. Published offerings are never touched.
  const { error: delError } = await supabase
    .from('professional_offerings')
    .delete()
    .eq('contractor_id', user.id)
    .eq('status', 'draft')
  if (delError) return GENERIC_ERROR

  const { error } = await supabase
    .from('professional_offerings')
    .insert(rows.map((r) => ({ ...r, contractor_id: user.id, status: 'draft' })))
  if (error) return GENERIC_ERROR

  return completeOnboarding(supabase, user.id)
}

export async function skipOfferings(): Promise<ActionResult> {
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if ('error' in a) return a.error
  const gate = await requireStep5(a.supabase, a.user.id)
  if (gate) return gate
  return completeOnboarding(a.supabase, a.user.id)
}

/** Offerings/completion are only reachable after documents were submitted. */
async function requireStep5(supabase: Supa, userId: string): Promise<ActionResult | null> {
  const profile = await loadCategory(supabase, userId)
  if (!profile) return GENERIC_ERROR
  if (profile.step < 5) {
    return { ok: false, error: 'Please finish uploading your documents first.' }
  }
  return null
}

async function completeOnboarding(supabase: Supa, userId: string): Promise<ActionResult> {
  const { error } = await supabase
    .from('contractor_profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId)
    .is('onboarding_completed_at', null)
  if (error) return GENERIC_ERROR
  return { ok: true }
}
