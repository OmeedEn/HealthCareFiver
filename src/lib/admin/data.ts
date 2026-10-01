import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminDb = ReturnType<typeof createAdminClient>

export interface AdminUserRow {
  id: string
  email: string | null
  phone: string | null
  role: string | null
  name: string
  createdAt: string
  emailConfirmedAt: string | null
  lastSignInAt: string | null
  isActive: boolean
  isVerified: boolean
  verificationStatus: string | null
  subscriptionStatus: string | null
}

/** Every auth user. Fine at soft-launch scale; paginate in the UI past ~5k. */
export async function listAuthUsers(db: AdminDb): Promise<User[]> {
  const users: User[] = []
  const perPage = 1000
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < perPage) break
  }
  return users
}

/**
 * Join auth.users (sign-in / confirmation timestamps) with profiles and the
 * role-specific profile tables into one row per account. Accounts whose
 * profile row is missing still appear — that's a signup bug worth seeing.
 */
export async function listAdminUsers(db: AdminDb): Promise<AdminUserRow[]> {
  const [authUsers, profiles, contractors, facilities, clients] = await Promise.all([
    listAuthUsers(db),
    db
      .from('profiles')
      .select('id, role, email, phone, is_active, is_verified, subscription_status'),
    db
      .from('contractor_profiles')
      .select('id, first_name, last_name, verification_status'),
    db.from('facility_profiles').select('id, facility_name, contact_name'),
    db.from('client_profiles').select('id, first_name, last_name'),
  ])

  const profileById = new Map((profiles.data ?? []).map((p) => [p.id, p]))
  const contractorById = new Map((contractors.data ?? []).map((c) => [c.id, c]))
  const facilityById = new Map((facilities.data ?? []).map((f) => [f.id, f]))
  const clientById = new Map((clients.data ?? []).map((c) => [c.id, c]))

  return authUsers
    .map((u): AdminUserRow => {
      const profile = profileById.get(u.id)
      const contractor = contractorById.get(u.id)
      const facility = facilityById.get(u.id)
      const client = clientById.get(u.id)
      const meta = u.user_metadata ?? {}
      const name =
        (contractor &&
          `${contractor.first_name ?? ''} ${contractor.last_name ?? ''}`.trim()) ||
        facility?.facility_name ||
        (client && `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()) ||
        `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim() ||
        meta.full_name ||
        '—'

      return {
        id: u.id,
        email: u.email ?? profile?.email ?? null,
        phone: u.phone || profile?.phone || null,
        role: profile?.role ?? (meta.role as string | undefined) ?? null,
        name,
        createdAt: u.created_at,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        isActive: profile?.is_active ?? false,
        isVerified: profile?.is_verified ?? false,
        verificationStatus: contractor?.verification_status ?? null,
        subscriptionStatus: profile?.subscription_status ?? null,
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function countCreatedWithinDays(users: AdminUserRow[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return users.filter((u) => new Date(u.createdAt).getTime() > cutoff).length
}

export interface ActivityItem {
  id: string
  at: string
  kind: 'signup' | 'login' | 'admin' | 'audit' | 'bug'
  text: string
  userId: string | null
}

/**
 * A single "what's been happening" feed: signups, logins, admin decisions,
 * audited actions, and bug reports, newest first.
 */
export async function recentActivity(
  db: AdminDb,
  users: AdminUserRow[],
  limit = 50
): Promise<ActivityItem[]> {
  const nameOf = (id: string | null) => {
    if (!id) return 'System'
    const u = users.find((x) => x.id === id)
    return u ? (u.name !== '—' ? u.name : u.email ?? id) : id.slice(0, 8)
  }

  const [adminLog, auditLog, bugs] = await Promise.all([
    db
      .from('admin_audit_log')
      .select('id, admin_id, action, entity_id, new_value, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    db
      .from('audit_log')
      .select('id, actor_id, action, resource_type, resource_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    db
      .from('bug_reports')
      .select('id, user_id, title, severity, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const items: ActivityItem[] = []

  for (const u of users) {
    items.push({
      id: `signup-${u.id}`,
      at: u.createdAt,
      kind: 'signup',
      text: `${nameOf(u.id)} created a ${u.role ?? 'unknown-role'} account`,
      userId: u.id,
    })
    if (u.lastSignInAt) {
      items.push({
        id: `login-${u.id}`,
        at: u.lastSignInAt,
        kind: 'login',
        text: `${nameOf(u.id)} signed in`,
        userId: u.id,
      })
    }
  }

  for (const row of adminLog.data ?? []) {
    const status =
      row.new_value && typeof row.new_value === 'object'
        ? Object.values(row.new_value as Record<string, unknown>).join(', ')
        : ''
    items.push({
      id: `admin-${row.id}`,
      at: row.created_at,
      kind: 'admin',
      text: `${nameOf(row.admin_id)} → ${row.action.replaceAll('_', ' ')} for ${nameOf(row.entity_id)}${status ? ` (${status})` : ''}${row.notes ? ` — “${row.notes}”` : ''}`,
      userId: row.entity_id,
    })
  }

  for (const row of auditLog.data ?? []) {
    items.push({
      id: `audit-${row.id}`,
      at: row.created_at,
      kind: 'audit',
      text: `${nameOf(row.actor_id)}: ${row.action.replaceAll('_', ' ')}${row.resource_type && row.resource_type !== 'system' ? ` on ${row.resource_type}` : ''}`,
      userId: row.actor_id,
    })
  }

  for (const row of bugs.data ?? []) {
    items.push({
      id: `bug-${row.id}`,
      at: row.created_at,
      kind: 'bug',
      text: `${nameOf(row.user_id)} reported a ${row.severity} bug: ${row.title}`,
      userId: row.user_id,
    })
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}
