import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendCredentialExpiringEmail,
  sendCredentialLapsedEmail,
  sendExclusionRescreenDigestEmail,
  sendInsuranceDeadlinePassedEmail,
  sendInsuranceGraceReminderEmail,
} from '@/lib/email/resend'
import {
  EXCLUSION_DIGEST_WEEKDAY,
  EXCLUSION_RESCREEN_DAYS,
  EXPIRY_REMINDER_DAYS,
  GRACE_REMINDER_DAYS,
  INSURANCE_REF,
  LAPSE_CREDENTIAL_TYPES,
  LIVE_VERIFICATION_STATUSES,
  REMINDER_KIND,
  addDays,
  daysLeftUntil,
  daysUntilDate,
  dueThreshold,
  formatLongDate,
  isoDate,
} from './config'
import {
  ONCE_VERIFIED_STATUSES,
  VALID_CREDENTIAL_STATUSES,
  credentialLabel,
  findHoldLapse,
  findMalpracticeLapse,
  isSuperseded,
  type CredentialRow,
} from './rules'
import {
  chunk,
  claimReminders,
  loadProviderContacts,
  notify,
  reminderKeyString,
  sendSafely,
  type ReminderKey,
} from './notify'

/**
 * Daily compliance job (called by /api/cron/compliance after the CRON_SECRET
 * check). Every step is idempotent: state changes are guarded by WHERE
 * clauses and every provider-facing message is de-duplicated through
 * compliance_reminders, so re-running the same day is a no-op.
 *
 *   1. Mark verified credentials past expiration_date as 'expired'.
 *   2. Malpractice grace: reminders at 14/7/1 days left; after the deadline,
 *      pause published/pending requires_malpractice listings + email once.
 *   3. Expiry reminders 60/30 days out (credentials + license_expiration_date).
 *   4. Lapses: license/cert/ID ⇒ compliance hold; malpractice ⇒ Insured badge
 *      off + requires_malpractice listings paused. Provider emailed once each.
 *   5. Weekly admin digest of live providers due for exclusion re-screening.
 */

const CRED_COLUMNS = 'id, contractor_id, credential_type, name, status, expiration_date'
const LIVE = LIVE_VERIFICATION_STATUSES as readonly string[]

export type ComplianceCronResult = {
  expiredMarked: number
  graceReminders: number
  graceDeadlinesPassed: number
  offeringsPaused: number
  expiryReminders: number
  holdsSet: number
  malpracticeLapses: number
  lapseEmails: number
  exclusionDigest: { sent: boolean; due: number; skipped?: string }
}

type Ctx = { admin: SupabaseClient; now: Date; today: string; appUrl: string }

export async function runComplianceCron(
  admin: SupabaseClient,
  opts: { now?: Date; appUrl: string; forceDigest?: boolean }
): Promise<ComplianceCronResult> {
  const now = opts.now ?? new Date()
  const ctx: Ctx = { admin, now, today: isoDate(now), appUrl: opts.appUrl }

  const expiredMarked = await markExpiredCredentials(ctx)
  const grace = await runMalpracticeGrace(ctx)
  const expiryReminders = await runExpiryReminders(ctx)
  const lapses = await runLapses(ctx)
  const exclusionDigest =
    opts.forceDigest || now.getUTCDay() === EXCLUSION_DIGEST_WEEKDAY
      ? await runExclusionDigest(ctx)
      : { sent: false, due: 0, skipped: 'not digest day' }

  return {
    expiredMarked,
    graceReminders: grace.reminders,
    graceDeadlinesPassed: grace.deadlinesPassed,
    offeringsPaused: grace.paused + lapses.paused,
    expiryReminders,
    holdsSet: lapses.holdsSet,
    malpracticeLapses: lapses.malpractice,
    lapseEmails: lapses.emails,
    exclusionDigest,
  }
}

// ---------------------------------------------------------------------------
// Shared queries
// ---------------------------------------------------------------------------

async function loadCredentialsFor(
  ctx: Ctx,
  contractorIds: string[],
  types?: readonly string[]
): Promise<CredentialRow[]> {
  const out: CredentialRow[] = []
  for (const part of chunk([...new Set(contractorIds)])) {
    let q = ctx.admin.from('credentials').select(CRED_COLUMNS).in('contractor_id', part)
    if (types) q = q.in('credential_type', [...types])
    const { data, error } = await q
    if (error) throw new Error(`Failed to load credentials: ${error.message}`)
    out.push(...((data ?? []) as CredentialRow[]))
  }
  return out
}

/** Pause published / pending-review listings that need malpractice. */
async function pauseMalpracticeOfferings(
  ctx: Ctx,
  contractorIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const part of chunk([...new Set(contractorIds)])) {
    const { data, error } = await ctx.admin
      .from('professional_offerings')
      .update({ status: 'paused' })
      .in('contractor_id', part)
      .eq('requires_malpractice', true)
      .in('status', ['published', 'pending_review'])
      .select('id, contractor_id')
    if (error) {
      console.error('[compliance] Failed to pause offerings', error)
      continue
    }
    for (const row of data ?? []) {
      const id = row.contractor_id as string
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = out.get(k)
    if (list) list.push(r)
    else out.set(k, [r])
  }
  return out
}

// ---------------------------------------------------------------------------
// 1. Expired credentials
// ---------------------------------------------------------------------------

async function markExpiredCredentials(ctx: Ctx): Promise<number> {
  const { data, error } = await ctx.admin
    .from('credentials')
    .update({ status: 'expired' })
    .in('status', [...VALID_CREDENTIAL_STATUSES])
    .lt('expiration_date', ctx.today)
    .select(CRED_COLUMNS)
  if (error) throw new Error(`Failed to mark expired credentials: ${error.message}`)

  // License/cert/ID/malpractice lapses get a richer notice in step 4 (live
  // providers only); other credential types keep the plain in-app notice.
  const lapseTypes = LAPSE_CREDENTIAL_TYPES as readonly string[]
  for (const cred of (data ?? []) as CredentialRow[]) {
    if (lapseTypes.includes(cred.credential_type)) continue
    await notify(ctx.admin, {
      userId: cred.contractor_id,
      type: 'credential_expiring',
      title: 'Credential Expired',
      body: `Your credential "${cred.name}" has expired. Please upload an updated version.`,
      href: '/contractor/credentials/upload',
      data: { credential_id: cred.id },
    })
  }
  return data?.length ?? 0
}

// ---------------------------------------------------------------------------
// 2. Malpractice grace period
// ---------------------------------------------------------------------------

async function runMalpracticeGrace(
  ctx: Ctx
): Promise<{ reminders: number; deadlinesPassed: number; paused: number }> {
  const { data, error } = await ctx.admin
    .from('contractor_profiles')
    .select('id, insurance_due_at')
    .eq('verification_status', 'insurance_pending')
    .is('insured_verified_at', null)
    .not('insurance_due_at', 'is', null)
  if (error) throw new Error(`Failed to load insurance-pending providers: ${error.message}`)

  const reminderRows: { id: string; dueAt: string; daysLeft: number; key: ReminderKey }[] = []
  const overdue: string[] = []
  for (const row of data ?? []) {
    const dueAt = row.insurance_due_at as string
    const daysLeft = daysLeftUntil(new Date(dueAt), ctx.now)
    if (daysLeft <= 0) {
      overdue.push(row.id as string)
      continue
    }
    const threshold = dueThreshold(daysLeft, GRACE_REMINDER_DAYS)
    if (threshold === null) continue
    reminderRows.push({
      id: row.id as string,
      dueAt,
      daysLeft,
      key: {
        contractor_id: row.id as string,
        kind: REMINDER_KIND.insuranceGrace,
        threshold_days: threshold,
        ref: INSURANCE_REF,
      },
    })
  }

  // Reminders
  const claimed = await claimReminders(ctx.admin, reminderRows.map((r) => r.key))
  const toRemind = reminderRows.filter((r) => claimed.has(reminderKeyString(r.key)))
  const overdueKeys: ReminderKey[] = overdue.map((id) => ({
    contractor_id: id,
    kind: REMINDER_KIND.insuranceDeadline,
    threshold_days: 0,
    ref: INSURANCE_REF,
  }))

  // Deadline passed: pause (idempotent), then claim the one-time notice.
  const pausedCounts = overdue.length ? await pauseMalpracticeOfferings(ctx, overdue) : new Map()
  const claimedOverdue = await claimReminders(ctx.admin, overdueKeys)
  const toNotifyOverdue = overdueKeys
    .filter((k) => claimedOverdue.has(reminderKeyString(k)))
    .map((k) => k.contractor_id)

  const contacts = await loadProviderContacts(ctx.admin, [
    ...toRemind.map((r) => r.id),
    ...toNotifyOverdue,
  ])

  for (const r of toRemind) {
    const left = `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'}`
    await notify(ctx.admin, {
      userId: r.id,
      type: 'credential_expiring',
      title: `${left} left to upload your malpractice certificate`,
      body: `Upload it by ${formatLongDate(r.dueAt)}. Hands-on, home-visit, prescribing, injectable, and IV listings stay unpublished until it's reviewed.`,
      href: '/contractor/credentials/upload',
    })
    await sendSafely('Malpractice grace reminder', contacts.get(r.id), (to) =>
      sendInsuranceGraceReminderEmail(to, ctx.appUrl, r.daysLeft, r.dueAt)
    )
  }

  for (const id of toNotifyOverdue) {
    const paused = pausedCounts.get(id) ?? 0
    await notify(ctx.admin, {
      userId: id,
      type: 'system',
      title: 'Your malpractice deadline has passed',
      body:
        paused > 0
          ? `${paused} listing${paused === 1 ? '' : 's'} requiring malpractice coverage ${paused === 1 ? 'was' : 'were'} paused. Upload your certificate to reactivate.`
          : 'Listings requiring malpractice coverage stay unpublished until your certificate is reviewed.',
      href: '/contractor/credentials/upload',
    })
    await sendSafely('Malpractice deadline passed', contacts.get(id), (to) =>
      sendInsuranceDeadlinePassedEmail(to, ctx.appUrl, paused)
    )
  }

  let paused = 0
  for (const n of pausedCounts.values()) paused += n
  return { reminders: toRemind.length, deadlinesPassed: toNotifyOverdue.length, paused }
}

// ---------------------------------------------------------------------------
// 3. Expiry reminders (60 / 30 days)
// ---------------------------------------------------------------------------

async function liveProviderIds(ctx: Ctx, ids: string[]): Promise<Set<string>> {
  const live = new Set<string>()
  for (const part of chunk([...new Set(ids)])) {
    const { data, error } = await ctx.admin
      .from('contractor_profiles')
      .select('id')
      .in('id', part)
      .in('verification_status', [...LIVE])
    if (error) throw new Error(`Failed to load providers: ${error.message}`)
    for (const row of data ?? []) live.add(row.id as string)
  }
  return live
}

type ExpiryReminder = {
  contractorId: string
  label: string
  expirationDate: string
  daysLeft: number
  threshold: number
  credentialId: string | null
  key: ReminderKey
}

async function runExpiryReminders(ctx: Ctx): Promise<number> {
  const maxDays = Math.max(...EXPIRY_REMINDER_DAYS)
  const horizon = isoDate(addDays(ctx.now, maxDays))
  const candidates: ExpiryReminder[] = []

  // a) Verified credentials expiring within the window (all credential types).
  const { data: expiring, error } = await ctx.admin
    .from('credentials')
    .select(CRED_COLUMNS)
    .in('status', [...VALID_CREDENTIAL_STATUSES])
    .gte('expiration_date', ctx.today)
    .lte('expiration_date', horizon)
  if (error) throw new Error(`Failed to load expiring credentials: ${error.message}`)
  const expiringCreds = (expiring ?? []) as CredentialRow[]

  // b) Self-reported license expiration dates within the window (live providers).
  const { data: licenseRows, error: licenseError } = await ctx.admin
    .from('contractor_profiles')
    .select('id, license_expiration_date')
    .in('verification_status', [...LIVE])
    .gte('license_expiration_date', ctx.today)
    .lte('license_expiration_date', horizon)
  if (licenseError) throw new Error(`Failed to load license dates: ${licenseError.message}`)

  const contractorIds = [
    ...expiringCreds.map((c) => c.contractor_id),
    ...(licenseRows ?? []).map((r) => r.id as string),
  ]
  if (contractorIds.length === 0) return 0
  const live = await liveProviderIds(ctx, contractorIds)
  const allCreds = await loadCredentialsFor(ctx, [...live])

  for (const cred of expiringCreds) {
    if (!live.has(cred.contractor_id) || isSuperseded(cred, allCreds)) continue
    const daysLeft = daysUntilDate(cred.expiration_date!, ctx.now)
    const threshold = dueThreshold(daysLeft, EXPIRY_REMINDER_DAYS)
    if (threshold === null) continue
    candidates.push({
      contractorId: cred.contractor_id,
      label: credentialLabel(cred),
      expirationDate: cred.expiration_date!,
      daysLeft,
      threshold,
      credentialId: cred.id,
      key: {
        contractor_id: cred.contractor_id,
        kind: REMINDER_KIND.credentialExpiry,
        threshold_days: threshold,
        ref: cred.id,
      },
    })
  }

  const credsByContractor = groupBy(allCreds, (c) => c.contractor_id)
  for (const row of licenseRows ?? []) {
    const id = row.id as string
    const date = row.license_expiration_date as string
    // A verified license credential expiring on/after this date already gets
    // its own reminder (or is a renewal) — don't double up.
    const covered = (credsByContractor.get(id) ?? []).some(
      (c) =>
        c.credential_type === 'license' &&
        (VALID_CREDENTIAL_STATUSES as readonly string[]).includes(c.status) &&
        (c.expiration_date === null || c.expiration_date >= date)
    )
    if (covered) continue
    const daysLeft = daysUntilDate(date, ctx.now)
    const threshold = dueThreshold(daysLeft, EXPIRY_REMINDER_DAYS)
    if (threshold === null) continue
    candidates.push({
      contractorId: id,
      label: 'license',
      expirationDate: date,
      daysLeft,
      threshold,
      credentialId: null,
      key: {
        contractor_id: id,
        kind: REMINDER_KIND.licenseDateExpiry,
        threshold_days: threshold,
        ref: `license_date:${date}`,
      },
    })
  }

  const claimed = await claimReminders(ctx.admin, candidates.map((c) => c.key))
  const toSend = candidates.filter((c) => claimed.has(reminderKeyString(c.key)))
  if (toSend.length === 0) return 0

  // Keep the legacy flag columns (and the 'expiring_soon' UI status) in sync.
  const at30 = toSend.filter((c) => c.credentialId && c.threshold <= 30).map((c) => c.credentialId!)
  const at60 = toSend.filter((c) => c.credentialId && c.threshold > 30).map((c) => c.credentialId!)
  for (const part of chunk(at30)) {
    const { error: e } = await ctx.admin
      .from('credentials')
      .update({ status: 'expiring_soon', expiry_alert_30_sent: true })
      .in('id', part)
      .eq('status', 'verified')
    if (e) console.error('[compliance] Failed to flag 30-day alerts', e)
  }
  for (const part of chunk(at60)) {
    const { error: e } = await ctx.admin
      .from('credentials')
      .update({ expiry_alert_60_sent: true })
      .in('id', part)
    if (e) console.error('[compliance] Failed to flag 60-day alerts', e)
  }

  const contacts = await loadProviderContacts(ctx.admin, toSend.map((c) => c.contractorId))
  for (const c of toSend) {
    await notify(ctx.admin, {
      userId: c.contractorId,
      type: 'credential_expiring',
      title: `Your ${c.label} expires in ${c.daysLeft} days`,
      body: `It expires on ${formatLongDate(c.expirationDate)}. Upload the renewed document before then.`,
      href: '/contractor/credentials/upload',
      data: c.credentialId ? { credential_id: c.credentialId } : undefined,
    })
    await sendSafely('Credential expiring', contacts.get(c.contractorId), (to) =>
      sendCredentialExpiringEmail(to, ctx.appUrl, {
        label: c.label,
        expirationDate: c.expirationDate,
        daysLeft: c.daysLeft,
      })
    )
  }
  return toSend.length
}

// ---------------------------------------------------------------------------
// 4. Lapses
// ---------------------------------------------------------------------------

type LapseProvider = {
  id: string
  license_expiration_date: string | null
  insured_verified_at: string | null
  compliance_hold_reason: string | null
}

async function runLapses(
  ctx: Ctx
): Promise<{ holdsSet: number; malpractice: number; paused: number; emails: number }> {
  // Candidates: anyone with a once-verified lapse-type credential past expiry,
  // or a self-reported license date in the past.
  const { data: lapsedCreds, error } = await ctx.admin
    .from('credentials')
    .select('contractor_id')
    .in('credential_type', [...LAPSE_CREDENTIAL_TYPES])
    .in('status', [...ONCE_VERIFIED_STATUSES])
    .lt('expiration_date', ctx.today)
  if (error) throw new Error(`Failed to load lapsed credentials: ${error.message}`)
  const { data: pastLicense, error: pastError } = await ctx.admin
    .from('contractor_profiles')
    .select('id')
    .in('verification_status', [...LIVE])
    .lt('license_expiration_date', ctx.today)
  if (pastError) throw new Error(`Failed to load license dates: ${pastError.message}`)

  const candidateIds = [
    ...new Set([
      ...(lapsedCreds ?? []).map((r) => r.contractor_id as string),
      ...(pastLicense ?? []).map((r) => r.id as string),
    ]),
  ]
  if (candidateIds.length === 0) return { holdsSet: 0, malpractice: 0, paused: 0, emails: 0 }

  const providers: LapseProvider[] = []
  for (const part of chunk(candidateIds)) {
    const { data, error: e } = await ctx.admin
      .from('contractor_profiles')
      .select('id, license_expiration_date, insured_verified_at, compliance_hold_reason')
      .in('id', part)
      .in('verification_status', [...LIVE])
    if (e) throw new Error(`Failed to load providers: ${e.message}`)
    providers.push(...((data ?? []) as LapseProvider[]))
  }
  const creds = groupBy(
    await loadCredentialsFor(ctx, providers.map((p) => p.id), LAPSE_CREDENTIAL_TYPES),
    (c) => c.contractor_id
  )

  type Notice = { contractorId: string; label: string; expirationDate: string; effect: 'hold' | 'listings_paused'; key: ReminderKey }
  const notices: Notice[] = []
  const malpracticeLapsed: string[] = []
  let holdsSet = 0

  for (const p of providers) {
    const pc = creds.get(p.id) ?? []

    const hold = findHoldLapse(p, pc, ctx.now)
    if (hold) {
      if (!p.compliance_hold_reason) {
        // Only fill an empty hold — never overwrite a manual reason.
        const { data, error: e } = await ctx.admin
          .from('contractor_profiles')
          .update({ compliance_hold_reason: hold.holdReason })
          .eq('id', p.id)
          .is('compliance_hold_reason', null)
          .select('id')
        if (e) console.error('[compliance] Failed to set hold', e)
        else if (data?.length) holdsSet++
      }
      notices.push({
        contractorId: p.id,
        label: hold.label,
        expirationDate: hold.expirationDate,
        effect: 'hold',
        key: { contractor_id: p.id, kind: REMINDER_KIND.lapse, threshold_days: 0, ref: hold.ref },
      })
    }

    const mal = findMalpracticeLapse(p, pc, ctx.now)
    if (mal) {
      malpracticeLapsed.push(p.id)
      notices.push({
        contractorId: p.id,
        label: mal.label,
        expirationDate: mal.expirationDate,
        effect: 'listings_paused',
        key: { contractor_id: p.id, kind: REMINDER_KIND.lapse, threshold_days: 0, ref: mal.ref },
      })
    }
  }

  // Malpractice lapse: badge off, then pause listings that need it.
  for (const part of chunk(malpracticeLapsed)) {
    const { error: e } = await ctx.admin
      .from('contractor_profiles')
      .update({ insured_verified_at: null })
      .in('id', part)
    if (e) console.error('[compliance] Failed to clear insured_verified_at', e)
  }
  const pausedCounts = malpracticeLapsed.length
    ? await pauseMalpracticeOfferings(ctx, malpracticeLapsed)
    : new Map<string, number>()
  let paused = 0
  for (const n of pausedCounts.values()) paused += n

  const claimed = await claimReminders(ctx.admin, notices.map((n) => n.key))
  const toSend = notices.filter((n) => claimed.has(reminderKeyString(n.key)))
  const contacts = await loadProviderContacts(ctx.admin, toSend.map((n) => n.contractorId))
  for (const n of toSend) {
    await notify(ctx.admin, {
      userId: n.contractorId,
      type: 'credential_expiring',
      title: `Your ${n.label} has expired`,
      body:
        n.effect === 'hold'
          ? `It expired on ${formatLongDate(n.expirationDate)}. Your profile is hidden from search until we verify a current document.`
          : `It expired on ${formatLongDate(n.expirationDate)}. Your Insured badge is off and listings that need malpractice coverage are paused.`,
      href: '/contractor/credentials/upload',
    })
    await sendSafely('Credential lapsed', contacts.get(n.contractorId), (to) =>
      sendCredentialLapsedEmail(to, ctx.appUrl, {
        label: n.label,
        expirationDate: n.expirationDate,
        effect: n.effect,
      })
    )
  }

  return { holdsSet, malpractice: malpracticeLapsed.length, paused, emails: toSend.length }
}

// ---------------------------------------------------------------------------
// 5. Exclusion re-screen digest (weekly)
// ---------------------------------------------------------------------------

async function runExclusionDigest(
  ctx: Ctx
): Promise<{ sent: boolean; due: number; skipped?: string }> {
  const to = process.env.ADMIN_ALERT_EMAIL
  const cutoff = addDays(ctx.now, -EXCLUSION_RESCREEN_DAYS).toISOString()
  const { data, error } = await ctx.admin
    .from('contractor_profiles')
    .select('id, first_name, last_name, last_exclusion_check_at')
    .in('verification_status', [...LIVE])
    .or(`last_exclusion_check_at.is.null,last_exclusion_check_at.lt.${cutoff}`)
    .order('last_exclusion_check_at', { ascending: true, nullsFirst: true })
  if (error) throw new Error(`Failed to load exclusion re-screen list: ${error.message}`)

  const due = data ?? []
  if (due.length === 0) return { sent: false, due: 0, skipped: 'none due' }
  if (!to) return { sent: false, due: due.length, skipped: 'ADMIN_ALERT_EMAIL not set' }

  try {
    await sendExclusionRescreenDigestEmail(
      to,
      ctx.appUrl,
      due.map((r) => ({
        id: r.id as string,
        name: `${(r.first_name as string | null) ?? ''} ${(r.last_name as string | null) ?? ''}`.trim(),
        lastCheckedAt: (r.last_exclusion_check_at as string | null) ?? null,
      }))
    )
    return { sent: true, due: due.length }
  } catch (err) {
    console.error('[compliance] Failed to send exclusion digest', err)
    return { sent: false, due: due.length, skipped: 'send failed' }
  }
}
