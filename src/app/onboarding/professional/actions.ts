'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentUser, requireRole, type SessionUser } from '@/lib/auth/roles'
import { isDemoMode } from '@/lib/demo/data'
import { CREDENTIALS_BUCKET } from '@/lib/credentials/document'
import { submitContractorForReview } from '@/lib/verification/submit-for-review'
import { markSubmitted, recordProgress } from '@/lib/onboarding/progress'
import {
  branchHasComplianceQuestions,
  effectiveBranch,
  isCredentialBasis,
  isProfessionalCategory,
  type CredentialBasis,
  type ProfessionalBranch,
  type ProfessionalCategory,
} from '@/lib/onboarding/professional-branch'
import {
  DISCLOSURE_DETAILS_MAX,
  DISCLOSURE_KEYS,
  PRO_Q,
  PRO_SKIPPABLE,
  identityScreenFor,
  normalizeWebsiteUrl,
  professionColumns,
  proValid,
  type ProSignupAnswers,
} from '@/lib/onboarding/questions/professional'
import { PROFESSION_MAX } from '@/lib/onboarding/professions'
import {
  SLOT_LABEL,
  credentialTypeFor,
  type ActionResult,
  type DocSlotKey,
  type UploadedDoc,
} from './shared'

/*
 * Server actions for /onboarding/professional (screens 5–8, plus screens 1–3
 * when they weren't answered before the account) and the dashboard's upload
 * items. Every action:
 *   - authenticates with currentUser() (enforces MFA/AAL2 when enabled) and
 *     requireRole('contractor');
 *   - only reads/writes rows owned by that user;
 *   - decides the branch from the STORED category and credential_basis via
 *     effectiveBranch(), never from client input;
 *   - records the screen in onboarding_progress so a refresh resumes on the
 *     first unanswered screen;
 *   - is a no-op in demo mode (no Supabase configured).
 */

type Supa = Awaited<ReturnType<typeof createClient>>

const SESSION_EXPIRED: ActionResult = {
  ok: false,
  error: 'Your session has expired. Please sign in again.',
}
const GENERIC_ERROR: ActionResult = {
  ok: false,
  error: 'Something went wrong saving your answer. Please try again.',
}
const ANSWER_EARLIER: ActionResult = {
  ok: false,
  error: 'Please answer the earlier questions first.',
}

// Credentials a contractor may withdraw themselves. Never verified ones.
const REMOVABLE_CREDENTIAL_STATUSES = ['pending_upload', 'pending_review', 'rejected']

async function authed(): Promise<{ user: SessionUser; supabase: Supa } | null> {
  try {
    const user = requireRole(await currentUser(), 'contractor')
    return { user, supabase: await createClient() }
  } catch {
    return null
  }
}

interface Stored {
  category: ProfessionalCategory | null
  basis: CredentialBasis | null
  /** null until a category (and, for Other, a basis) is saved */
  branch: ProfessionalBranch | null
  completed: boolean
  disclosures: Record<string, unknown>
}

async function loadStored(supabase: Supa, userId: string): Promise<Stored | null> {
  const { data, error } = await supabase
    .from('contractor_profiles')
    .select('professional_category, credential_basis, onboarding_completed_at, self_disclosures')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  const category = isProfessionalCategory(data.professional_category) ? data.professional_category : null
  const basis = isCredentialBasis(data.credential_basis) ? data.credential_basis : null
  return {
    category,
    basis,
    branch: category && (category !== 'other' || basis) ? effectiveBranch(category, basis) : null,
    completed: !!data.onboarding_completed_at,
    disclosures:
      data.self_disclosures && typeof data.self_disclosures === 'object'
        ? (data.self_disclosures as Record<string, unknown>)
        : {},
  }
}

async function update(supabase: Supa, userId: string, columns: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('contractor_profiles').update(columns).eq('id', userId)
  if (error) console.error('[onboarding/professional] update failed', error.code)
  return !error
}

/* ───────────── Screens 1–3 (post-account fallback) ───────────── */

/**
 * Save one of screens 1–3 for a signed-in professional who didn't answer
 * them before the account (Google without its cookie, a Not sure account
 * staff placed as independent, or an older account).
 */
export async function saveIdentityAnswer(id: string, input: ProSignupAnswers): Promise<ActionResult> {
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if (!a) return SESSION_EXPIRED
  const { user, supabase } = a
  const stored = await loadStored(supabase, user.id)
  if (!stored) return GENERIC_ERROR

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  let columns: Record<string, unknown>

  switch (id) {
    case PRO_Q.category: {
      if (!isProfessionalCategory(input?.category)) return { ok: false, error: 'Choose what kind of professional you are.' }
      columns = { professional_category: input.category }
      if (input.category !== 'other') Object.assign(columns, { other_profession: null, credential_basis: null })
      break
    }
    case PRO_Q.profession: {
      if (!stored.category || stored.category === 'other') return ANSWER_EARLIER
      const v = str(input?.profession)
      if (!proValid.profession(v)) return { ok: false, error: 'Tell us your profession or specialty.' }
      columns = professionColumns(stored.category, v)
      break
    }
    case PRO_Q.otherProfession: {
      if (stored.category !== 'other') return ANSWER_EARLIER
      const v = str(input?.other_profession)
      if (!v || v.length > PROFESSION_MAX) return { ok: false, error: 'Tell us your profession.' }
      columns = { other_profession: v }
      break
    }
    case PRO_Q.credentialBasis: {
      if (stored.category !== 'other') return ANSWER_EARLIER
      if (!isCredentialBasis(input?.credential_basis)) return { ok: false, error: 'Choose an option.' }
      columns = { credential_basis: input.credential_basis }
      break
    }
    case PRO_Q.license:
    case PRO_Q.certifyingOrg:
    case PRO_Q.website: {
      if (!stored.branch) return ANSWER_EARLIER
      if (identityScreenFor(stored.branch) !== id) return ANSWER_EARLIER
      if (id === PRO_Q.license) {
        const number = str(input?.license_number)
        const state = str(input?.license_state)
        if (!proValid.licenseNumber(number) || !proValid.state(state)) {
          return { ok: false, error: 'Enter your license number and the state that issued it.' }
        }
        columns = { state_license_number: number, license_state: state, license_states: [state] }
      } else if (id === PRO_Q.certifyingOrg) {
        const org = str(input?.certifying_organization)
        if (!proValid.certifyingOrg(org)) return { ok: false, error: 'Tell us which organization certified you.' }
        columns = { certifying_organization: org }
      } else if (input?.no_website === true) {
        columns = { website_url: null }
      } else {
        const url = normalizeWebsiteUrl(str(input?.website_url))
        if (!url) return { ok: false, error: 'Enter a link like linkedin.com/in/yourname, or choose “I don’t have one”.' }
        columns = { website_url: url }
      }
      break
    }
    default:
      return { ok: false, error: 'Unknown question.' }
  }

  if (!(await update(supabase, user.id, columns))) return GENERIC_ERROR
  return recordProgress(supabase, user.id, 'professional', { answered: [id] })
}

/* ───────────── Screens 5–6: uploads ───────────── */

/** Mark an upload screen answered (file in) or skipped ("Skip for now"). */
export async function markScreen(id: string, kind: 'answered' | 'skipped'): Promise<ActionResult> {
  if (isDemoMode()) return { ok: true }
  if (id !== PRO_Q.credentialUpload && id !== PRO_Q.governmentId) return { ok: false, error: 'Unknown question.' }
  if (kind === 'skipped' && !PRO_SKIPPABLE.has(id)) return { ok: false, error: 'This question can’t be skipped.' }
  const a = await authed()
  if (!a) return SESSION_EXPIRED
  return recordProgress(a.supabase, a.user.id, 'professional', { [kind]: [id] })
}

const recordDocSchema = z.object({
  slot: z.enum(['credential', 'government_id']),
  path: z.string().min(3).max(500),
  filename: z.string().trim().min(1).max(255),
  replaceId: z.string().uuid().nullable(),
})

export type RecordDocumentResult = { ok: true; doc: UploadedDoc } | { ok: false; error: string }

/**
 * Record a document the browser already uploaded to the private credentials
 * bucket at `{user_id}/…` (pending_review row holding the storage PATH).
 * With replaceId, withdraws the previous upload afterwards. Also checks the
 * matching screen off in onboarding_progress.
 */
export async function recordDocument(input: {
  slot: DocSlotKey
  path: string
  filename: string
  replaceId: string | null
}): Promise<RecordDocumentResult> {
  const parsed = recordDocSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid upload.' }
  const { slot, path, filename, replaceId } = parsed.data

  if (isDemoMode()) {
    return {
      ok: true,
      doc: {
        id: `demo-${slot}-${Date.now()}`,
        credential_type: slot === 'government_id' ? 'government_id' : 'license',
        name: filename,
        document_filename: filename,
        document_url: path,
        status: 'pending_review',
      },
    }
  }

  const a = await authed()
  if (!a) return { ok: false, error: 'Your session has expired. Please sign in again.' }
  const { user, supabase } = a

  // The object must live in the caller's own folder (storage RLS enforces the
  // upload side; this stops a row pointing at someone else's file).
  if (!path.startsWith(`${user.id}/`) || path.includes('..')) return { ok: false, error: 'Invalid upload.' }

  const stored = await loadStored(supabase, user.id)
  if (!stored?.branch) return { ok: false, error: 'Please answer the earlier questions first.' }
  const credentialType = slot === 'government_id' ? 'government_id' : credentialTypeFor(stored.branch)

  const { data, error } = await supabase
    .from('credentials')
    .insert({
      contractor_id: user.id,
      credential_type: credentialType,
      name: SLOT_LABEL[credentialType],
      status: 'pending_review',
      document_url: path,
      document_filename: filename,
    })
    .select('id, credential_type, name, document_filename, document_url, status')
    .single()
  if (error || !data) return { ok: false, error: 'We couldn’t save that document. Please try again.' }

  if (replaceId) await withdrawCredential(user.id, replaceId)
  await recordProgress(supabase, user.id, 'professional', {
    answered: [slot === 'government_id' ? PRO_Q.governmentId : PRO_Q.credentialUpload],
  })
  return { ok: true, doc: data as UploadedDoc }
}

export async function removeDocument(credentialId: string): Promise<ActionResult> {
  if (isDemoMode()) return { ok: true }
  if (!z.string().uuid().safeParse(credentialId).success) return { ok: false, error: 'Invalid document.' }
  const a = await authed()
  if (!a) return SESSION_EXPIRED
  return (await withdrawCredential(a.user.id, credentialId))
    ? { ok: true }
    : { ok: false, error: 'We couldn’t remove that document. Please try again.' }
}

/**
 * Delete one of the caller's own not-yet-verified credentials and its stored
 * object. There is no owner DELETE policy on `credentials` or on the storage
 * bucket, so this uses the service role, scoped by contractor_id = caller
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
    const { error: rmError } = await admin.storage.from(CREDENTIALS_BUCKET).remove([path])
    if (rmError) console.error('onboarding: failed to remove credential object', rmError.message)
  }
  return true
}

/* ───────────── Screen 7: disclosures (licensed + allied) ───────────── */

const disclosuresSchema = z.object({
  picked: z.array(z.enum(DISCLOSURE_KEYS as [string, ...string[]])).max(4),
  details: z.string().trim().max(DISCLOSURE_DETAILS_MAX),
})

/**
 * "Do any of these apply to you?" → the existing self_disclosures shape
 * ({key: {answer, details}}) so the admin flags keep working. One shared
 * "Tell us a bit more" text goes on every picked item. No picks = "None of
 * these apply".
 */
export async function saveDisclosures(input: { picked: string[]; details: string }): Promise<ActionResult> {
  const parsed = disclosuresSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please check your answer and try again.' }
  const { picked, details } = parsed.data
  if (picked.length > 0 && !details) {
    return { ok: false, error: 'Tell us a bit more.', fields: { details: 'Tell us a bit more' } }
  }
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if (!a) return SESSION_EXPIRED
  const json = Object.fromEntries(
    DISCLOSURE_KEYS.map((k) => {
      const yes = picked.includes(k)
      return [k, { answer: yes, details: yes ? details : null }]
    })
  )
  if (!(await update(a.supabase, a.user.id, { self_disclosures: json }))) return GENERIC_ERROR
  return recordProgress(a.supabase, a.user.id, 'professional', { answered: [PRO_Q.disclosures] })
}

/* ───────────── Screen 8: confirm and submit ───────────── */

const submitSchema = z.object({
  attest_accurate: z.literal(true),
  authorize_checks: z.literal(true),
})

/**
 * Attestations → submit for review (not_submitted / more_info_requested →
 * pending_review) → onboarding complete, so the proxy lets them into
 * /dashboard. Uploads are NOT required (beta: skipping never blocks
 * submission; missing uploads block approval instead).
 */
export async function submitApplication(input: {
  attest_accurate: boolean
  authorize_checks: boolean
}): Promise<ActionResult> {
  if (!submitSchema.safeParse(input).success) {
    return { ok: false, error: 'Please check both boxes to submit.' }
  }
  if (isDemoMode()) return { ok: true }
  const a = await authed()
  if (!a) return SESSION_EXPIRED
  const { user, supabase } = a

  const stored = await loadStored(supabase, user.id)
  if (!stored) return GENERIC_ERROR
  if (!stored.branch) return ANSWER_EARLIER
  if (
    branchHasComplianceQuestions(stored.branch) &&
    !DISCLOSURE_KEYS.every((k) => {
      const d = stored.disclosures[k]
      return !!d && typeof d === 'object' && typeof (d as { answer?: unknown }).answer === 'boolean'
    })
  ) {
    return { ok: false, error: 'Please answer “Do any of these apply to you?” first.' }
  }

  const now = new Date().toISOString()
  if (!(await update(supabase, user.id, { attested_accurate_at: now, authorized_checks_at: now }))) {
    return GENERIC_ERROR
  }

  const submitted = await submitContractorForReview(user.id)
  if (!submitted.ok) return GENERIC_ERROR

  const progress = await recordProgress(supabase, user.id, 'professional', { answered: [PRO_Q.submit] })
  if (!progress.ok) return progress
  const marked = await markSubmitted(supabase, user.id, 'professional')
  if (!marked.ok) return marked

  if (!stored.completed) {
    const { error } = await supabase
      .from('contractor_profiles')
      .update({ onboarding_completed_at: now })
      .eq('id', user.id)
      .is('onboarding_completed_at', null)
    if (error) return GENERIC_ERROR
  }
  return { ok: true }
}
