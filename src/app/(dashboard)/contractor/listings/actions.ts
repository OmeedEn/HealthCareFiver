'use server'

import { revalidatePath } from 'next/cache'
import { startInsuranceGraceForListing } from '@/lib/compliance/transitions'
import { createAdminClient } from '@/lib/supabase/admin'
import { blockedClaimsMessage, findBlockedClaims } from '@/lib/listings/claims'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { currentUser, requireRole, type SessionUser } from '@/lib/auth/roles'
import { isDemoMode } from '@/lib/demo/data'
import { getOwnListing, getProviderState } from '@/lib/listings/data'
import {
  LISTING_STEP_KEYS,
  emptyListing,
  firstErrors,
  inputToColumns,
  listingFieldErrors,
  listingIsComplete,
  listingSchema,
  stepColumns,
  type ListingDraft,
  type OfferingKind,
} from '@/lib/listings/offering'

/*
 * Listing actions for /contractor/listings. Every action authenticates with
 * currentUser() (enforces MFA/AAL2) + requireRole('contractor') and only
 * touches rows where contractor_id = the caller. Saving always makes the row
 * a draft; the only other status a provider can set is 'pending_review'.
 * The database (RLS + professional_offerings triggers) is the real gate —
 * the checks here exist to give a clear message.
 */

export type SaveListingResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export type SaveListingStepResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; fields?: Record<string, string> }

export type SubmitListingResult =
  | { ok: true }
  | { ok: false; error: string; href?: string; hrefLabel?: string }

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'
const idSchema = z.string().uuid()

async function authed(): Promise<SessionUser | null> {
  try {
    return requireRole(await currentUser(), 'contractor')
  } catch {
    return null
  }
}

function isMissingV3Column(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  return (
    err.code === 'PGRST204' ||
    err.code === '42703' ||
    /involves_medical_procedures/.test(err.message ?? '')
  )
}

export async function saveListing(
  id: string | null,
  input: unknown
): Promise<SaveListingResult> {
  if (id !== null && !idSchema.safeParse(id).success) {
    return { ok: false, error: 'Listing not found.' }
  }
  const parsed = listingSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: firstErrors(parsed.error.issues),
    }
  }
  {
    const d = parsed.data as { title?: string; description?: string | null }
    const claims = findBlockedClaims(d.title, d.description)
    if (claims.length) {
      return { ok: false, error: blockedClaimsMessage(claims), fieldErrors: { description: blockedClaimsMessage(claims) } }
    }
  }
  if (isDemoMode()) {
    return { ok: true, id: id ?? '00000000-0000-4000-8000-000000000002' }
  }

  const user = await authed()
  if (!user) return { ok: false, error: SESSION_EXPIRED }
  const supabase = await createClient()

  const columns = { ...inputToColumns(parsed.data), status: 'draft' }
  const withoutV3 = { ...columns } as Record<string, unknown>
  delete withoutV3.involves_medical_procedures

  if (id) {
    const run = (cols: Record<string, unknown>) =>
      supabase
        .from('professional_offerings')
        .update(cols)
        .eq('id', id)
        .eq('contractor_id', user.id)
        .select('id')
        .maybeSingle()
    let { data, error } = await run(columns)
    if (isMissingV3Column(error)) ({ data, error } = await run(withoutV3))
    if (error) {
      console.error('[listings] update failed', error.message)
      return { ok: false, error: "We couldn't save this listing. Please try again." }
    }
    if (!data) return { ok: false, error: 'Listing not found.' }
    await maybeStartInsuranceGrace(user.id, columns)
    revalidatePath('/contractor/listings')
    return { ok: true, id }
  }

  const run = (cols: Record<string, unknown>) =>
    supabase
      .from('professional_offerings')
      .insert({ ...cols, contractor_id: user.id })
      .select('id')
      .single()
  let { data, error } = await run(columns)
  if (isMissingV3Column(error)) ({ data, error } = await run(withoutV3))
  if (error || !data) {
    console.error('[listings] insert failed', error?.message)
    return { ok: false, error: "We couldn't save this listing. Please try again." }
  }
  revalidatePath('/contractor/listings')
  await maybeStartInsuranceGrace(user.id, columns)
  return { ok: true, id: data.id as string }
}

const KINDS: readonly OfferingKind[] = ['service', 'consulting', 'event']

/** Untrusted client input → a ListingDraft (unknown or mistyped fields dropped). */
function toDraft(input: unknown): ListingDraft | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const kind = KINDS.find((k) => k === raw.kind)
  if (!kind) return null
  const d = emptyListing(kind) as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(d)) {
    if (k in raw && typeof raw[k] === typeof v) d[k] = raw[k]
  }
  return d as unknown as ListingDraft
}

/**
 * Save the answer to one question of the "new listing" flow
 * (src/components/listings/listing-questions.tsx). Each answer is checked
 * with the same listingSchema rules as the full form, field by field. The
 * first save that includes a title creates the draft (the only required
 * column); later saves update just the answered columns. Only drafts change
 * here — the flow's last question calls saveListing with the whole listing.
 */
export async function saveListingStep(
  id: string | null,
  input: unknown,
  keys: string[]
): Promise<SaveListingStepResult> {
  if (id !== null && !idSchema.safeParse(id).success) {
    return { ok: false, error: 'Listing not found.' }
  }
  const draft = toDraft(input)
  if (!draft || !Array.isArray(keys)) return { ok: false, error: 'Invalid listing.' }
  const known = keys.filter((k) => (LISTING_STEP_KEYS as readonly string[]).includes(k))
  const fields = listingFieldErrors(draft, known)
  if (Object.keys(fields).length) {
    return { ok: false, error: 'Please fix the highlighted fields.', fields }
  }
  const columns = stepColumns(draft, known)
  if ('title' in columns || 'description' in columns) {
    const claims = findBlockedClaims(draft.title, draft.description)
    if (claims.length) {
      const msg = blockedClaimsMessage(claims)
      return { ok: false, error: msg, fields: { description: msg } }
    }
  }
  // Nothing to create yet (e.g. an event's type is asked before its title).
  if (!id && !columns.title) return { ok: true, id: null }
  if (isDemoMode()) return { ok: true, id: id ?? '00000000-0000-4000-8000-000000000002' }

  const user = await authed()
  if (!user) return { ok: false, error: SESSION_EXPIRED }
  const supabase = await createClient()

  const cols = { ...columns, kind: draft.kind }
  const withoutV3 = { ...cols } as Record<string, unknown>
  delete withoutV3.involves_medical_procedures

  const run = (c: Record<string, unknown>) =>
    id
      ? supabase
          .from('professional_offerings')
          .update(c)
          .eq('id', id)
          .eq('contractor_id', user.id)
          .eq('status', 'draft')
          .select('id')
          .maybeSingle()
      : supabase
          .from('professional_offerings')
          .insert({ ...c, contractor_id: user.id, status: 'draft' })
          .select('id')
          .maybeSingle()
  let { data, error } = await run(cols)
  if (isMissingV3Column(error)) ({ data, error } = await run(withoutV3))
  if (error || !data) {
    if (error) console.error('[listings] step save failed', error.message)
    return { ok: false, error: "We couldn't save that. Please try again." }
  }
  await maybeStartInsuranceGrace(user.id, cols)
  return { ok: true, id: data.id as string }
}

export async function submitListingForReview(
  id: string
): Promise<SubmitListingResult> {
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: 'Listing not found.' }
  }
  if (isDemoMode()) return { ok: true }

  const user = await authed()
  if (!user) return { ok: false, error: SESSION_EXPIRED }
  const supabase = await createClient()

  const [state, listing] = await Promise.all([
    getProviderState(supabase, user.id),
    getOwnListing(supabase, user.id, id),
  ])
  if (!listing) return { ok: false, error: 'Listing not found.' }
  if (listing.status === 'pending_review') return { ok: true }
  if (listing.status === 'published') {
    return { ok: false, error: 'This listing is already published.' }
  }
  // Listings save question by question, so a draft can be unfinished.
  if (!listingIsComplete(listing)) {
    return {
      ok: false,
      error: 'Finish this listing first: a few questions are still unanswered.',
      href: `/contractor/listings/new?draft=${id}`,
      hrefLabel: 'Finish the listing',
    }
  }
  if (!state.isApproved) {
    return { ok: false, error: 'You can publish once your application is approved' }
  }
  if (state.complianceHoldReason) {
    return {
      ok: false,
      error: 'Your account is on hold, so listings can’t be submitted right now.',
      href: '/dashboard',
      hrefLabel: 'See what to do',
    }
  }
  if (!state.hasAgreement) {
    return {
      ok: false,
      error: 'Accept the provider agreement to publish your first listing',
      href: '/go-live',
      hrefLabel: 'Review the agreement',
    }
  }

  const { data, error } = await supabase
    .from('professional_offerings')
    .update({ status: 'pending_review' })
    .eq('id', id)
    .eq('contractor_id', user.id)
    .in('status', ['draft', 'rejected', 'paused'])
    .select('id')
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[listings] submit failed', error.message)
    return {
      ok: false,
      error: "We couldn't submit this listing for review. Please try again.",
    }
  }
  revalidatePath('/contractor/listings')
  revalidatePath(`/contractor/listings/${id}/review`)
  return { ok: true }
}

export async function deleteListing(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: 'Listing not found.' }
  }
  if (isDemoMode()) return { ok: true }

  const user = await authed()
  if (!user) return { ok: false, error: SESSION_EXPIRED }
  const supabase = await createClient()

  const { error } = await supabase
    .from('professional_offerings')
    .delete()
    .eq('id', id)
    .eq('contractor_id', user.id)
  if (error) {
    console.error('[listings] delete failed', error.message)
    return { ok: false, error: "We couldn't delete this listing. Please try again." }
  }
  revalidatePath('/contractor/listings')
  return { ok: true }
}

/**
 * Saving an in-person / home-visit / medical-procedure listing when they told
 * us in onboarding they don't offer high-risk services: start the insurance
 * grace period so they get the deadline, banner and reminders instead of a
 * listing that silently never publishes. Failures are logged, never thrown.
 */
async function maybeStartInsuranceGrace(userId: string, columns: Record<string, unknown>) {
  const needsMalpractice =
    columns.format === 'in_person' || columns.format === 'home_visit' || columns.involves_medical_procedures === true
  if (!needsMalpractice) return
  try {
    await startInsuranceGraceForListing(createAdminClient(), userId)
  } catch (err) {
    console.error('[listings] could not start insurance grace period', err)
  }
}
