import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseConfig } from '@/lib/supabase/config'

export interface AuditEntry {
  actorId: string | null
  actorRole?: string | null
  action: string
  targetTable?: string
  targetId?: string
  phiAccessed?: boolean
  metadata?: Record<string, unknown>
}

/**
 * Record a HIPAA Security Rule §164.312(b) audit event. Writes to audit_log
 * via the service-role client (bypassing RLS) so the call is allowed even when
 * the caller's session has no write privilege on the table.
 *
 * Failures are logged but never thrown — an audit-store outage must not block
 * the primary action. Sentry will surface the underlying error.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  if (!getSupabaseConfig()) {
    // Demo mode — no DB to write to.
    return
  }

  let ipAddress: string | null = null
  let userAgent: string | null = null
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    ipAddress = forwarded ? forwarded.split(',')[0].trim() : h.get('x-real-ip')
    userAgent = h.get('user-agent')
  } catch {
    // Called outside a request scope (e.g. cron) — skip request metadata.
  }

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_log').insert({
      actor_id: entry.actorId,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      target_table: entry.targetTable ?? null,
      target_id: entry.targetId ?? null,
      phi_accessed: entry.phiAccessed ?? false,
      metadata: entry.metadata ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    if (error) {
      console.error('audit log insert failed:', error, entry)
    }
  } catch (err) {
    console.error('audit log unavailable:', err, entry)
  }
}
