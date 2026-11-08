import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { OPEN_DISPUTE_STATUSES } from '@/lib/admin/queue-counts'

type AdminDb = ReturnType<typeof createAdminClient>

export interface PendingItem {
  key: string
  /** Queue name, e.g. "Professional". */
  kind: string
  title: string
  /** When it started waiting on us (ISO). */
  at: string
  href: string
}

const fullName = (first: unknown, last: unknown) =>
  `${typeof first === 'string' ? first : ''} ${typeof last === 'string' ? last : ''}`.trim()

/**
 * The oldest items across every admin queue, oldest first. Each queue is
 * capped so one backlog can't hide the rest; failures drop that queue only.
 */
export async function loadOldestPending(
  db: AdminDb,
  nameOf: (userId: string) => string,
  limit = 15
): Promise<PendingItem[]> {
  const per = limit
  const [pros, orgs, docs, signups, listings, orgListings, threads, care, bugs, disputes] = await Promise.all([
    db
      .from('contractor_profiles')
      .select('id, first_name, last_name, updated_at')
      .eq('verification_status', 'pending_review')
      .order('updated_at', { ascending: true })
      .limit(per),
    db
      .from('facility_profiles')
      .select('id, facility_name, onboarding_submitted_at')
      .eq('verification_status', 'pending_review')
      .not('onboarding_submitted_at', 'is', null)
      .order('onboarding_submitted_at', { ascending: true })
      .limit(per),
    db
      .from('credentials')
      .select('id, name, contractor_id, created_at, contractor_profiles!contractor_id(first_name, last_name)')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })
      .limit(per),
    db
      .from('profiles')
      .select('id, email, created_at')
      .eq('signup_path', 'UNSURE')
      .eq('classification_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(per),
    db
      .from('professional_offerings')
      .select('id, title, updated_at')
      .eq('status', 'pending_review')
      .order('updated_at', { ascending: true })
      .limit(per),
    db
      .from('org_listings')
      .select('id, title, submitted_at, updated_at, facility_profiles(facility_name)')
      .eq('status', 'in_review')
      .order('updated_at', { ascending: true })
      .limit(per),
    db
      .from('conversations')
      .select('id, participant_1, last_message_at, last_message_sender_id, last_message_preview')
      .eq('is_support', true)
      .not('last_message_sender_id', 'is', null)
      .order('last_message_at', { ascending: true })
      .limit(500),
    db
      .from('care_requests')
      .select('id, user_id, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(per),
    db
      .from('bug_reports')
      .select('id, title, severity, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(per),
    db
      .from('disputes')
      .select('id, reason, created_at')
      .in('status', [...OPEN_DISPUTE_STATUSES])
      .order('created_at', { ascending: true })
      .limit(per),
  ])

  for (const [label, r] of Object.entries({ pros, orgs, docs, signups, listings, orgListings, threads, care, bugs, disputes })) {
    if (r.error) console.error(`[admin/overview] ${label} failed`, r.error.message)
  }

  const items: PendingItem[] = []
  for (const p of pros.data ?? []) {
    items.push({
      key: `pro-${p.id}`,
      kind: 'Professional',
      title: fullName(p.first_name, p.last_name) || nameOf(p.id),
      at: p.updated_at,
      href: `/admin/verification/${p.id}`,
    })
  }
  for (const o of orgs.data ?? []) {
    items.push({
      key: `org-${o.id}`,
      kind: 'Organization',
      title: o.facility_name || nameOf(o.id),
      at: o.onboarding_submitted_at as string,
      href: `/admin/organizations/${o.id}`,
    })
  }
  for (const d of docs.data ?? []) {
    const c = d.contractor_profiles as unknown as { first_name: string | null; last_name: string | null } | null
    items.push({
      key: `doc-${d.id}`,
      kind: 'Document',
      title: `${d.name} · ${fullName(c?.first_name, c?.last_name) || nameOf(d.contractor_id)}`,
      at: d.created_at,
      href: '/admin/review/documents',
    })
  }
  for (const s of signups.data ?? []) {
    items.push({
      key: `signup-${s.id}`,
      kind: 'Unsure signup',
      title: nameOf(s.id) || s.email || s.id,
      at: s.created_at,
      href: '/admin/review/signups',
    })
  }
  for (const l of listings.data ?? []) {
    items.push({ key: `listing-${l.id}`, kind: 'Pro listing', title: l.title, at: l.updated_at, href: '/admin/review/listings' })
  }
  for (const l of orgListings.data ?? []) {
    const org = l.facility_profiles as unknown as { facility_name: string | null } | null
    items.push({
      key: `org-listing-${l.id}`,
      kind: 'Org listing',
      title: org?.facility_name ? `${l.title} · ${org.facility_name}` : l.title,
      at: (l.submitted_at as string | null) ?? l.updated_at,
      href: '/admin/review/org-listings',
    })
  }
  for (const t of (threads.data ?? []).filter((c) => c.last_message_sender_id === c.participant_1).slice(0, per)) {
    items.push({
      key: `msg-${t.id}`,
      kind: 'Support message',
      title: `${nameOf(t.participant_1)}${t.last_message_preview ? `: ${t.last_message_preview}` : ''}`,
      at: t.last_message_at ?? new Date().toISOString(),
      href: `/admin/messages/${t.participant_1}`,
    })
  }
  for (const c of care.data ?? []) {
    items.push({ key: `care-${c.id}`, kind: 'Care request', title: nameOf(c.user_id), at: c.created_at, href: '/admin/inbox/care-requests' })
  }
  for (const b of bugs.data ?? []) {
    items.push({
      key: `bug-${b.id}`,
      kind: `Bug (${b.severity})`,
      title: b.title,
      at: b.created_at,
      href: `/admin/inbox/bugs?id=${b.id}`,
    })
  }
  for (const d of disputes.data ?? []) {
    items.push({ key: `dispute-${d.id}`, kind: 'Dispute', title: d.reason, at: d.created_at, href: '/admin/inbox/disputes' })
  }

  return items.sort((a, b) => a.at.localeCompare(b.at)).slice(0, limit)
}

/** Live listings across pros and orgs. */
export async function countLiveListings(db: AdminDb): Promise<number> {
  const head = { count: 'exact' as const, head: true }
  const [pro, org] = await Promise.all([
    db.from('professional_offerings').select('id', head).eq('status', 'published'),
    db.from('org_listings').select('id', head).eq('status', 'published'),
  ])
  return (pro.count ?? 0) + (org.count ?? 0)
}
