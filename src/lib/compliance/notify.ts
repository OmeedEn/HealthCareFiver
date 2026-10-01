import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProviderEmailContext } from '@/lib/email/resend'

/**
 * Side-effect helpers for the compliance lifecycle (server only — pass the
 * service-role client). Notifications and emails are best-effort: they log
 * and swallow errors so a failed send never undoes a state change.
 */

const CHUNK = 200

export function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Absolute base URL for email links. */
export function resolveAppUrl(fallback?: string): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    fallback ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  )
}

export type ProviderContact = Omit<ProviderEmailContext, 'email'> & { email: string | null }

/** Names (contractor_profiles) + emails (profiles) for a batch of providers. */
export async function loadProviderContacts(
  admin: SupabaseClient,
  ids: string[]
): Promise<Map<string, ProviderContact>> {
  const out = new Map<string, ProviderContact>()
  const unique = [...new Set(ids)]
  for (const part of chunk(unique)) {
    const [{ data: names, error: namesError }, { data: emails, error: emailsError }] =
      await Promise.all([
        admin.from('contractor_profiles').select('id, first_name, last_name').in('id', part),
        admin.from('profiles').select('id, email').in('id', part),
      ])
    if (namesError) console.error('[compliance] Failed to load provider names', namesError)
    if (emailsError) console.error('[compliance] Failed to load provider emails', emailsError)
    const emailById = new Map((emails ?? []).map((r) => [r.id as string, r.email as string | null]))
    for (const row of names ?? []) {
      out.set(row.id as string, {
        firstName: (row.first_name as string | null) ?? '',
        lastName: (row.last_name as string | null) ?? '',
        email: emailById.get(row.id as string) ?? null,
      })
    }
  }
  return out
}

export type NotificationType =
  | 'verification_approved'
  | 'credential_expiring'
  | 'credential_verified'
  | 'system'

/** Insert an in-app notification; never throws. */
export async function notify(
  admin: SupabaseClient,
  n: { userId: string; type: NotificationType; title: string; body: string; href?: string | null; data?: Record<string, unknown> }
): Promise<void> {
  const data = { ...(n.data ?? {}), ...(n.href ? { href: n.href } : {}) }
  const { error } = await admin.from('notifications').insert({
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    data: Object.keys(data).length ? data : null,
  })
  if (error) console.error('[compliance] Failed to create notification', error)
}

/** Send an email to a provider; logs and returns false on any failure. */
export async function sendSafely(
  label: string,
  contact: ProviderContact | undefined,
  send: (to: ProviderEmailContext) => Promise<unknown>
): Promise<boolean> {
  if (!contact?.email) {
    console.warn(`[compliance] No email on file — skipped "${label}"`)
    return false
  }
  try {
    await send({ firstName: contact.firstName, lastName: contact.lastName, email: contact.email })
    return true
  } catch (err) {
    console.error(`[compliance] Failed to send "${label}" email`, err)
    return false
  }
}

export type ReminderKey = {
  contractor_id: string
  kind: string
  threshold_days: number
  ref: string
}

export function reminderKeyString(k: ReminderKey): string {
  return `${k.contractor_id}|${k.kind}|${k.threshold_days}|${k.ref}`
}

/**
 * Claim reminders in compliance_reminders before sending. Rows that already
 * exist are skipped (ON CONFLICT DO NOTHING), so the returned set holds only
 * reminders this run is responsible for — safe against re-runs and
 * concurrent runs. A claimed reminder whose email then fails is not retried
 * (better a missed email than a daily repeat). On a DB error nothing is
 * claimed, so nothing is sent.
 */
export async function claimReminders(
  admin: SupabaseClient,
  keys: ReminderKey[]
): Promise<Set<string>> {
  const claimed = new Set<string>()
  if (keys.length === 0) return claimed
  // Dedupe within the batch — Postgres rejects an upsert touching a row twice.
  const unique = [...new Map(keys.map((k) => [reminderKeyString(k), k])).values()]
  for (const part of chunk(unique)) {
    const { data, error } = await admin
      .from('compliance_reminders')
      .upsert(part, {
        onConflict: 'contractor_id,kind,threshold_days,ref',
        ignoreDuplicates: true,
      })
      .select('contractor_id, kind, threshold_days, ref')
    if (error) {
      console.error('[compliance] Failed to claim reminders', error)
      continue
    }
    for (const row of data ?? []) claimed.add(reminderKeyString(row as ReminderKey))
  }
  return claimed
}
