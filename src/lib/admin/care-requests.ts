import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

// "Request help finding someone" queue (/admin/care-requests): clients whose
// results screen showed fewer than 3 matches. Rows come from care_requests
// (supabase/migrations/20261016000400_client_single_question.sql).

type AdminDb = ReturnType<typeof createAdminClient>

export const CARE_REQUEST_STATUSES = ['open', 'contacted', 'closed'] as const
export type CareRequestStatus = (typeof CARE_REQUEST_STATUSES)[number]

export function isCareRequestStatus(v: unknown): v is CareRequestStatus {
  return typeof v === 'string' && (CARE_REQUEST_STATUSES as readonly string[]).includes(v)
}

export interface CareRequestItem {
  id: string
  userId: string
  name: string
  email: string | null
  phone: string | null
  interests: string[]
  timeline: string | null
  formats: string[]
  zip: string | null
  note: string | null
  status: CareRequestStatus
  handledAt: string | null
  createdAt: string
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Open and contacted requests (oldest first), then the latest closed ones. */
export async function loadCareRequests(db: AdminDb, closedLimit = 25): Promise<CareRequestItem[]> {
  const cols = 'id, user_id, interests, timeline, formats, zip, note, status, handled_at, created_at'
  const [active, closed] = await Promise.all([
    db.from('care_requests').select(cols).in('status', ['open', 'contacted']).order('created_at', { ascending: true }).limit(500),
    db.from('care_requests').select(cols).eq('status', 'closed').order('handled_at', { ascending: false }).limit(closedLimit),
  ])
  if (active.error) throw new Error(`Failed to load care requests: ${active.error.message}`)
  const rows = [...(active.data ?? []), ...(closed.data ?? [])] as Record<string, unknown>[]
  const ids = Array.from(new Set(rows.map((r) => r.user_id as string)))
  if (!ids.length) return []

  const [profiles, clients] = await Promise.all([
    db.from('profiles').select('id, email, phone').in('id', ids),
    db.from('client_profiles').select('id, first_name, last_name').in('id', ids),
  ])
  const profileById = new Map((profiles.data ?? []).map((p) => [p.id as string, p]))
  const clientById = new Map((clients.data ?? []).map((c) => [c.id as string, c]))

  return rows.map((r) => {
    const userId = r.user_id as string
    const p = profileById.get(userId)
    const c = clientById.get(userId)
    return {
      id: r.id as string,
      userId,
      name: `${str(c?.first_name)} ${str(c?.last_name)}`.trim() || str(p?.email) || userId,
      email: (p?.email as string | null) ?? null,
      phone: (p?.phone as string | null) ?? null,
      interests: (r.interests as string[] | null) ?? [],
      timeline: (r.timeline as string | null) ?? null,
      formats: (r.formats as string[] | null) ?? [],
      zip: (r.zip as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      status: isCareRequestStatus(r.status) ? r.status : 'open',
      handledAt: (r.handled_at as string | null) ?? null,
      createdAt: r.created_at as string,
    }
  })
}

export async function setCareRequestStatus(
  db: AdminDb,
  id: string,
  status: Exclude<CareRequestStatus, 'open'>,
  adminId: string
): Promise<void> {
  const { error } = await db
    .from('care_requests')
    .update({ status, handled_by: adminId, handled_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Failed to update request (${error.code})`)
}
