import 'server-only'
import { headers } from 'next/headers'
import type { createAdminClient } from '@/lib/supabase/admin'
import { resolveAppUrl } from '@/lib/compliance/notify'
import { audit } from '@/lib/audit/log'
import { normalizeUsPhone } from '@/lib/phone'
import {
  sendClassificationAssignedEmail,
  sendClassificationRejectedEmail,
} from '@/lib/email/resend'
import {
  ONBOARDING_PATH_FOR,
  ROLE_FOR_PATH,
  SIGNUP_PATHS,
  SIGNUP_PATH_LABELS,
  type ClassifyDecision,
  type SignupPath,
} from '@/lib/onboarding/signup-path'
import { recordAssignmentPrefill, type StaffPicks } from '@/lib/onboarding/unsure-prefill'

// Staff placement of signups (Signup Routing Update): the "Needs
// classification" queue (/admin/classification) and the "Change category"
// control on /admin/users/[id] both go through assignSignupPath().

type AdminDb = ReturnType<typeof createAdminClient>

/** Categories staff can move an account into. */
export const ASSIGNABLE_PATHS = ['INDEPENDENT', 'PRACTICE', 'COMPANY', 'HIRING', 'CLIENT'] as const
export type AssignablePath = (typeof ASSIGNABLE_PATHS)[number]

export function isAssignablePath(v: unknown): v is AssignablePath {
  return typeof v === 'string' && (ASSIGNABLE_PATHS as readonly string[]).includes(v)
}

export interface AssignInput {
  userId: string
  adminId: string
  /** Target category. Ignored (may be null) for a REJECTED queue decision. */
  path: AssignablePath | null
  /** Set from the queue: recorded on classification_requests. */
  decision?: ClassifyDecision | null
  /** Optional note to the person; stored as decision_note and put in the email. */
  note?: string | null
  /** Email the person (assignment / rejection). Failures are logged, never thrown. */
  notify: boolean
  /**
   * Optional details staff picked with the category (professional category,
   * organization type). Pre-answers those screens; checked against the path.
   */
  picks?: StaffPicks
  appUrl: string
}

export interface AssignResult {
  oldRole: string
  oldSignupPath: string | null
  oldClassificationStatus: string | null
  newRole: string
  newSignupPath: string | null
  newClassificationStatus: string | null
  /** 'sent' | 'skipped' | 'failed' — email problems never fail the assignment. */
  email: 'sent' | 'skipped' | 'failed'
  /** True when the atomic SQL function was missing and sequential writes were used. */
  usedFallback: boolean
}

interface Prefill {
  first_name: string
  last_name: string
  city: string | null
  state: string | null
  zip_code: string | null
  website: string | null
  linkedin: string | null
  phone: string | null
}

interface AccountSnapshot {
  id: string
  role: string
  email: string | null
  phone: string | null
  signup_path: string | null
  classification_status: string | null
}

/**
 * Classify the free-text "Website or LinkedIn" answer. Returns a normalized
 * https URL in `website` or `linkedin`, or neither when it doesn't look like
 * a URL (e.g. "n/a", "@handle").
 */
export function splitWebsiteAnswer(raw: string | null | undefined): {
  website: string | null
  linkedin: string | null
} {
  const v = (raw ?? '').trim()
  if (!v || /\s/.test(v)) return { website: null, linkedin: null }
  if (!/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(v)) {
    return { website: null, linkedin: null }
  }
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`
  if (url.length > 300) return { website: null, linkedin: null }
  return /(^|\.)linkedin\.com/i.test(new URL(url).hostname)
    ? { website: null, linkedin: url }
    : { website: url, linkedin: null }
}

/** Absolute app URL for email links (NEXT_PUBLIC_APP_URL, else the request origin). */
export async function requestAppUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return resolveAppUrl(host ? `${proto}://${host}` : undefined)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

async function loadSnapshot(db: AdminDb, userId: string) {
  const [profile, client, contractor, facility, request] = await Promise.all([
    db
      .from('profiles')
      .select('id, role, email, phone, signup_path, classification_status')
      .eq('id', userId)
      .maybeSingle(),
    db.from('client_profiles').select('first_name, last_name, city, state, zip_code').eq('id', userId).maybeSingle(),
    db
      .from('contractor_profiles')
      .select('first_name, last_name, city, state, zip_code, website_url')
      .eq('id', userId)
      .maybeSingle(),
    db.from('facility_profiles').select('contact_name, city, state, zip_code, website').eq('id', userId).maybeSingle(),
    db
      .from('classification_requests')
      .select('city, state, website, team_size, credential, decision')
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  if (profile.error) throw new Error(`Failed to load account: ${profile.error.message}`)
  if (!profile.data) throw new Error('Account not found')

  const c = client.data
  const k = contractor.data
  const f = facility.data
  const r = request.data

  // Name: client → contractor → facility contact name (split on first space).
  let first = str(c?.first_name) || str(k?.first_name)
  let last = str(c?.last_name) || str(k?.last_name)
  if (!first && !last && str(f?.contact_name)) {
    const [a, ...rest] = str(f?.contact_name).split(/\s+/)
    first = a
    last = rest.join(' ')
  }

  // Location: the Not sure answers are the freshest, then whatever profile exists.
  const city = str(r?.city) || str(c?.city) || str(k?.city) || str(f?.city) || null
  const state = str(r?.state) || str(c?.state) || str(k?.state) || str(f?.state) || null
  const zip = str(c?.zip_code) || str(k?.zip_code) || str(f?.zip_code) || null
  const fromAnswer = splitWebsiteAnswer(r?.website)
  const website = fromAnswer.website || str(f?.website) || str(k?.website_url) || null

  const account = profile.data as AccountSnapshot
  const prefill: Prefill = {
    first_name: first.slice(0, 100),
    last_name: last.slice(0, 100),
    city: city ? city.slice(0, 100) : null,
    state: state && /^[A-Z]{2}$/.test(state.toUpperCase()) ? state.toUpperCase() : null,
    zip_code: zip && /^\d{5}$/.test(zip) ? zip : null,
    website,
    linkedin: fromAnswer.linkedin,
    phone: normalizeUsPhone(account.phone),
  }
  return {
    account,
    prefill,
    /** Not sure screens 2–3, for the prefill that maps them (unsure-prefill.ts). */
    answers: { teamSize: str(r?.team_size) || null, credential: str(r?.credential) || null },
    hasRequest: Boolean(r),
    requestDecided: Boolean(r?.decision),
  }
}

function expectedStatus(
  current: string | null,
  path: AssignablePath,
  fromQueue: boolean
): string | null {
  if (current === null && !fromQueue) return null
  return path === 'CLIENT' ? 'classified' : 'needs_info'
}

/**
 * Sequential version of admin_assign_signup_path() for databases where
 * 20261014000400_classification_assign.sql isn't applied yet. Ordered so a
 * failure part-way leaves the account in its old role (profile rows are
 * created first, role flips last) and the queue claim is released.
 */
async function assignFallback(
  db: AdminDb,
  input: AssignInput,
  snap: Awaited<ReturnType<typeof loadSnapshot>>
): Promise<Omit<AssignResult, 'email' | 'usedFallback'>> {
  const { account, prefill } = snap
  const now = new Date().toISOString()
  const note = (input.note ?? '').trim().slice(0, 2000) || null
  const fromQueue = Boolean(input.decision)
  const rejected = input.decision === 'REJECTED'

  // Claim the request first so two admins can't both decide it.
  let claimed = false
  if (fromQueue && snap.hasRequest) {
    const { data, error } = await db
      .from('classification_requests')
      .update({ decision: input.decision, decision_note: note, decided_by: input.adminId, decided_at: now })
      .eq('user_id', input.userId)
      .is('decision', null)
      .select('user_id')
    if (error) throw new Error(`Failed to record decision: ${error.message}`)
    if (!data?.length) throw new Error('This request was already decided.')
    claimed = true
  }

  const release = async () => {
    if (!claimed) return
    await db
      .from('classification_requests')
      .update({ decision: null, decision_note: null, decided_by: null, decided_at: null })
      .eq('user_id', input.userId)
  }

  try {
    if (rejected) {
      const { error } = await db
        .from('profiles')
        .update({ classification_status: 'rejected' })
        .eq('id', input.userId)
      if (error) throw new Error(`Failed to update account: ${error.message}`)
      return {
        oldRole: account.role,
        oldSignupPath: account.signup_path,
        oldClassificationStatus: account.classification_status,
        newRole: account.role,
        newSignupPath: account.signup_path,
        newClassificationStatus: 'rejected',
      }
    }

    const path = input.path as AssignablePath
    const role = ROLE_FOR_PATH[path]
    const status = expectedStatus(account.classification_status, path, fromQueue)

    if (path === 'INDEPENDENT') {
      const { data: existing } = await db
        .from('contractor_profiles')
        .select('id, first_name, last_name, city, state, zip_code, website_url')
        .eq('id', input.userId)
        .maybeSingle()
      const { error } = existing
        ? await db
            .from('contractor_profiles')
            .update({
              first_name: str(existing.first_name) || prefill.first_name,
              last_name: str(existing.last_name) || prefill.last_name,
              city: existing.city ?? prefill.city,
              state: existing.state ?? prefill.state,
              zip_code: existing.zip_code ?? prefill.zip_code,
              website_url: existing.website_url ?? (prefill.website || prefill.linkedin),
              verification_status: 'not_submitted',
              verification_notes: null,
              verification_reviewed_by: null,
              verification_reviewed_at: null,
              onboarding_completed_at: null,
              onboarding_step: 2,
            })
            .eq('id', input.userId)
        : await db.from('contractor_profiles').insert({
            id: input.userId,
            first_name: prefill.first_name,
            last_name: prefill.last_name,
            contractor_type: 'other',
            city: prefill.city,
            state: prefill.state,
            zip_code: prefill.zip_code,
            website_url: prefill.website || prefill.linkedin,
          })
      if (error) throw new Error(`Failed to set up the professional profile: ${error.message}`)
    } else if (path === 'CLIENT') {
      const { error } = await db.from('client_profiles').upsert(
        {
          id: input.userId,
          first_name: prefill.first_name,
          last_name: prefill.last_name,
          city: prefill.city,
          state: prefill.state,
          zip_code: prefill.zip_code,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      if (error) throw new Error(`Failed to set up the client profile: ${error.message}`)
    } else {
      const contact = `${prefill.first_name} ${prefill.last_name}`.trim().slice(0, 200) || null
      const linkedin = path === 'COMPANY' ? prefill.linkedin : null
      const { data: existing } = await db
        .from('facility_profiles')
        .select('id, contact_name, contact_email, contact_phone, phone, city, state, zip_code, website, lead_linkedin')
        .eq('id', input.userId)
        .maybeSingle()
      const { error } = existing
        ? await db
            .from('facility_profiles')
            .update({
              contact_name: existing.contact_name ?? contact,
              contact_email: existing.contact_email ?? account.email,
              contact_phone: existing.contact_phone ?? prefill.phone,
              phone: existing.phone ?? prefill.phone,
              city: existing.city ?? prefill.city,
              state: existing.state ?? prefill.state,
              zip_code: existing.zip_code ?? prefill.zip_code,
              website: existing.website ?? prefill.website,
              lead_linkedin: existing.lead_linkedin ?? linkedin,
              verification_status: 'pending_review',
              verification_notes: null,
              verification_reviewed_by: null,
              verification_reviewed_at: null,
              onboarding_submitted_at: null,
              onboarding_step: 2,
            })
            .eq('id', input.userId)
        : await db.from('facility_profiles').insert({
            id: input.userId,
            facility_name: '',
            facility_type: 'other',
            contact_name: contact,
            contact_email: account.email,
            contact_phone: prefill.phone,
            phone: prefill.phone,
            city: prefill.city,
            state: prefill.state,
            zip_code: prefill.zip_code,
            website: prefill.website,
            lead_linkedin: linkedin,
          })
      if (error) throw new Error(`Failed to set up the organization profile: ${error.message}`)
    }

    const profileUpdate: Record<string, unknown> = {
      role,
      signup_path: path,
      classification_status: status,
    }
    if (path !== 'CLIENT') profileUpdate.is_verified = false
    const { error } = await db.from('profiles').update(profileUpdate).eq('id', input.userId)
    if (error) throw new Error(`Failed to update account: ${error.message}`)

    return {
      oldRole: account.role,
      oldSignupPath: account.signup_path,
      oldClassificationStatus: account.classification_status,
      newRole: role,
      newSignupPath: path,
      newClassificationStatus: status,
    }
  } catch (err) {
    await release()
    throw err
  }
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function/i.test(error.message ?? '')
  )
}

/**
 * Place a Not sure signup or change any non-admin account's category.
 * Updates role / signup_path / classification_status, creates (or resets)
 * the contractor_profiles / facility_profiles row the new category needs,
 * records the queue decision, writes the admin + HIPAA audit logs, and
 * emails the person. Throws on validation/database errors; email failures
 * are logged and reported in the result.
 */
export async function assignSignupPath(db: AdminDb, input: AssignInput): Promise<AssignResult> {
  const rejected = input.decision === 'REJECTED'
  if (!rejected && !isAssignablePath(input.path)) throw new Error('Pick a category.')
  if (input.decision && !rejected && input.decision !== input.path) {
    throw new Error('Decision and category do not match.')
  }

  const snap = await loadSnapshot(db, input.userId)
  if (snap.account.role === 'admin') throw new Error("Admin accounts can't be reassigned.")
  if (input.decision && snap.requestDecided) throw new Error('This request was already decided.')
  if (
    !input.decision &&
    input.path === snap.account.signup_path &&
    ROLE_FOR_PATH[input.path as AssignablePath] === snap.account.role
  ) {
    throw new Error('The account is already in that category.')
  }

  const note = (input.note ?? '').trim().slice(0, 2000) || null
  let outcome: Omit<AssignResult, 'email' | 'usedFallback'>
  let usedFallback = false

  const { data, error } = await db.rpc('admin_assign_signup_path', {
    p_user_id: input.userId,
    p_path: rejected ? null : input.path,
    p_admin_id: input.adminId,
    p_decision: input.decision ?? null,
    p_note: note,
    p_prefill: snap.prefill,
  })
  if (isMissingFunction(error)) {
    console.warn('[admin/classification] admin_assign_signup_path missing; using sequential writes')
    usedFallback = true
    outcome = await assignFallback(db, input, snap)
  } else if (error) {
    throw new Error(error.message)
  } else {
    const r = data as Record<string, string | null>
    outcome = {
      oldRole: r.old_role ?? snap.account.role,
      oldSignupPath: r.old_signup_path ?? null,
      oldClassificationStatus: r.old_classification_status ?? null,
      newRole: r.new_role ?? snap.account.role,
      newSignupPath: r.new_signup_path ?? null,
      newClassificationStatus: r.new_classification_status ?? null,
    }
  }

  // The deep link resumes the new flow at the first unanswered screen: carry
  // over the Not sure answers that map cleanly (and staff's picks) and mark
  // those screens answered. Best effort; logged on failure.
  if (!rejected) {
    await recordAssignmentPrefill(
      db,
      input.userId,
      input.path as AssignablePath,
      {
        website: snap.prefill.website,
        linkedin: snap.prefill.linkedin,
        city: snap.prefill.city,
        state: snap.prefill.state,
        teamSize: snap.answers.teamSize,
        credential: snap.answers.credential,
      },
      input.picks
    )
  }

  const action = input.decision
    ? rejected
      ? 'classification_rejected'
      : 'classification_assigned'
    : 'signup_path_changed'
  const oldValue = {
    role: outcome.oldRole,
    signup_path: outcome.oldSignupPath,
    classification_status: outcome.oldClassificationStatus,
  }
  const newValue = {
    role: outcome.newRole,
    signup_path: outcome.newSignupPath,
    classification_status: outcome.newClassificationStatus,
    ...(input.decision ? { decision: input.decision } : {}),
  }
  const { error: logError } = await db.from('admin_audit_log').insert({
    admin_id: input.adminId,
    action,
    entity_type: 'profiles',
    entity_id: input.userId,
    old_value: oldValue,
    new_value: newValue,
    notes: note,
  })
  if (logError) console.error('[admin/classification] admin_audit_log insert failed', logError)
  await audit({
    actorId: input.adminId,
    actorRole: 'admin',
    action,
    targetTable: 'profiles',
    targetId: input.userId,
    metadata: newValue,
  })

  let email: AssignResult['email'] = 'skipped'
  if (input.notify && snap.account.email) {
    const person = { firstName: snap.prefill.first_name || null, email: snap.account.email }
    try {
      if (rejected) {
        await sendClassificationRejectedEmail(person, note)
      } else {
        const path = input.path as AssignablePath
        await sendClassificationAssignedEmail(
          person,
          {
            category: SIGNUP_PATH_LABELS[path],
            setupPath: ONBOARDING_PATH_FOR[path],
            isClient: path === 'CLIENT',
            note,
          },
          input.appUrl
        )
      }
      email = 'sent'
    } catch (err) {
      console.error(`[admin/classification] ${action} email failed`, err)
      email = 'failed'
    }
  }

  return { ...outcome, email, usedFallback }
}

/* ───────────── Read models for /admin/classification ───────────── */

/**
 * A Not sure answers row. has_location / wants / city / state are only set
 * on rows filed before the single-question flow (now asked from the
 * dashboard after placement); review_consent_at only on rows filed after.
 */
export interface ClassificationRequestRow {
  user_id: string
  what_you_do: string
  team_size: string
  has_location: boolean | null
  credential: string
  website: string | null
  wants: string[] | null
  city: string | null
  state: string | null
  review_consent_at?: string | null
  created_at: string
  decision: string | null
  decision_note: string | null
  decided_by: string | null
  decided_at: string | null
}

export interface QueueItem {
  userId: string
  name: string
  email: string | null
  phone: string | null
  signedUpAt: string
  request: ClassificationRequestRow | null
}

/** Accounts awaiting placement (UNSURE + pending), oldest first, with their answers. */
export async function loadClassificationQueue(db: AdminDb): Promise<QueueItem[]> {
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, email, phone, created_at')
    .eq('signup_path', 'UNSURE')
    .eq('classification_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) throw new Error(`Failed to load queue: ${error.message}`)
  const ids = (profiles ?? []).map((p) => p.id as string)
  if (!ids.length) return []

  const [clients, requests] = await Promise.all([
    db.from('client_profiles').select('id, first_name, last_name').in('id', ids),
    db.from('classification_requests').select('*').in('user_id', ids),
  ])
  const clientById = new Map((clients.data ?? []).map((c) => [c.id as string, c]))
  const requestById = new Map(
    ((requests.data ?? []) as ClassificationRequestRow[]).map((r) => [r.user_id, r])
  )

  return (profiles ?? []).map((p) => {
    const c = clientById.get(p.id)
    return {
      userId: p.id,
      name: `${str(c?.first_name)} ${str(c?.last_name)}`.trim() || p.email || p.id,
      email: p.email ?? null,
      phone: p.phone ?? null,
      signedUpAt: p.created_at,
      request: requestById.get(p.id) ?? null,
    }
  })
}

export async function countPendingClassification(db: AdminDb): Promise<number> {
  const { count } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('signup_path', 'UNSURE')
    .eq('classification_status', 'pending')
  return count ?? 0
}

export interface SignupPathShare {
  path: SignupPath | null
  last30: number
  allTime: number
}

/** Non-admin signups per door, last 30 days and all time. `path: null` = no door recorded. */
export async function loadSignupPathReport(db: AdminDb): Promise<SignupPathShare[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const paths: (SignupPath | null)[] = [...SIGNUP_PATHS, null]
  const base = () => db.from('profiles').select('id', { count: 'exact', head: true }).neq('role', 'admin')
  const withPath = (q: ReturnType<typeof base>, p: SignupPath | null) =>
    p === null ? q.is('signup_path', null) : q.eq('signup_path', p)

  return Promise.all(
    paths.map(async (path) => {
      const [recent, all] = await Promise.all([
        withPath(base(), path).gte('created_at', since),
        withPath(base(), path),
      ])
      return { path, last30: recent.count ?? 0, allTime: all.count ?? 0 }
    })
  )
}

export interface RecentAnswer extends ClassificationRequestRow {
  name: string
}

/** Newest "What do you do?" answers, decided or not. */
export async function loadRecentAnswers(db: AdminDb, limit = 50): Promise<RecentAnswer[]> {
  const { data } = await db
    .from('classification_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as ClassificationRequestRow[]
  if (!rows.length) return []
  const { data: clients } = await db
    .from('client_profiles')
    .select('id, first_name, last_name')
    .in('id', rows.map((r) => r.user_id))
  const nameById = new Map(
    (clients ?? []).map((c) => [c.id as string, `${str(c.first_name)} ${str(c.last_name)}`.trim()])
  )
  return rows.map((r) => ({ ...r, name: nameById.get(r.user_id) || r.user_id.slice(0, 8) }))
}
