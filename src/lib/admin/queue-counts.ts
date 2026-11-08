import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { countPendingClassification } from '@/lib/admin/classification'
import { countNeedsReply } from '@/lib/admin/support'
import { countPendingVerification } from '@/lib/admin/verification-counts'

type AdminDb = ReturnType<typeof createAdminClient>

/** Items waiting on an admin, per queue. Drives nav badges, tab counts and the overview. */
export interface QueueCounts {
  professionals: number
  organizations: number
  documents: number
  signups: number
  listings: number
  orgListings: number
  messages: number
  bugs: number
  careRequests: number
  disputes: number
}

/** Open disputes (anything not resolved/closed). */
export const OPEN_DISPUTE_STATUSES = ['open', 'under_review', 'escalated'] as const

// A broken count must never take the whole admin down: log it and show 0.
async function safe(label: string, p: PromiseLike<number>): Promise<number> {
  try {
    return await p
  } catch (err) {
    console.error(`[admin/queue-counts] ${label} failed`, err)
    return 0
  }
}

async function headCount(
  label: string,
  q: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  const { count, error } = await q
  if (error) throw new Error(`${label}: ${error.message}`)
  return count ?? 0
}

export async function loadQueueCounts(db: AdminDb): Promise<QueueCounts> {
  const head = { count: 'exact' as const, head: true }
  const [verification, documents, signups, listings, orgListings, messages, bugs, careRequests, disputes] =
    await Promise.all([
      countPendingVerification(db).catch((err) => {
        console.error('[admin/queue-counts] verification failed', err)
        return { pros: 0, orgs: 0 }
      }),
      safe('documents', headCount('documents', db.from('credentials').select('id', head).eq('status', 'pending_review'))),
      safe('signups', countPendingClassification(db)),
      safe(
        'listings',
        headCount('listings', db.from('professional_offerings').select('id', head).eq('status', 'pending_review'))
      ),
      safe('orgListings', headCount('orgListings', db.from('org_listings').select('id', head).eq('status', 'in_review'))),
      safe('messages', countNeedsReply(db)),
      safe('bugs', headCount('bugs', db.from('bug_reports').select('id', head).eq('status', 'open'))),
      safe('careRequests', headCount('careRequests', db.from('care_requests').select('id', head).eq('status', 'open'))),
      safe(
        'disputes',
        headCount('disputes', db.from('disputes').select('id', head).in('status', [...OPEN_DISPUTE_STATUSES]))
      ),
    ])
  return {
    professionals: verification.pros,
    organizations: verification.orgs,
    documents,
    signups,
    listings,
    orgListings,
    messages,
    bugs,
    careRequests,
    disputes,
  }
}

/**
 * Request-deduped counts (layout, section tabs and overview all ask). Callers
 * must have passed requireAdmin() first: this reads with the service role.
 */
export const getQueueCounts = cache(() => loadQueueCounts(createAdminClient()))

export function reviewTotal(c: QueueCounts): number {
  return c.professionals + c.organizations + c.documents + c.signups + c.listings + c.orgListings
}

export function inboxTotal(c: QueueCounts): number {
  return c.messages + c.bugs + c.careRequests + c.disputes
}
