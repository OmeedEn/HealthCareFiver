import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelativeTime } from '@/lib/utils/format'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { audit } from '@/lib/audit/log'
import { credentialDocumentHref } from '@/lib/credentials/document'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import {
  BugStatusBadge,
  EmailConfirmedBadge,
  SeverityBadge,
  VerificationBadge,
} from '@/components/admin/status-badges'
import { AccountActions } from './account-actions'
import { addAdminNote } from './actions'
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

const HIDDEN_FIELDS = new Set(['search_vector'])

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && /(_at|_date)$/.test(key) && !Number.isNaN(Date.parse(value))) {
    return formatDateTime(value)
  }
  return String(value)
}

function FieldGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => !HIDDEN_FIELDS.has(k))
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-[#9ca3af]">{key.replaceAll('_', ' ')}</dt>
          <dd className="break-words text-sm text-[#404145]">{formatValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base text-[#404145]">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (isDemoMode()) return <AdminDemoNotice />

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const { admin, db } = await requireAdmin()

  const { data: authData, error: authError } = await db.auth.admin.getUserById(id)
  if (authError || !authData?.user) notFound()
  const authUser = authData.user

  const [profile, contractor, facility, client, credentials, checks, memberships, applications, bugs, adminLog, auditLog] =
    await Promise.all([
      db.from('profiles').select('*').eq('id', id).maybeSingle(),
      db.from('contractor_profiles').select('*').eq('id', id).maybeSingle(),
      db.from('facility_profiles').select('*').eq('id', id).maybeSingle(),
      db.from('client_profiles').select('*').eq('id', id).maybeSingle(),
      db.from('credentials').select('*').eq('contractor_id', id).order('created_at', { ascending: false }),
      db.from('provider_verification_checks').select('check_type, status, result_summary, checked_at').eq('contractor_id', id),
      db.from('org_memberships').select('membership_type, joined_at, organizations(*)').eq('user_id', id),
      db.from('job_applications').select('id, status, created_at, job_id').eq('contractor_id', id).order('created_at', { ascending: false }).limit(20),
      db.from('bug_reports').select('id, title, severity, status, created_at').eq('user_id', id).order('created_at', { ascending: false }),
      db.from('admin_audit_log').select('id, admin_id, action, notes, new_value, created_at').eq('entity_id', id).order('created_at', { ascending: false }).limit(50),
      db.from('audit_log').select('id, action, resource_type, ip, created_at').eq('actor_id', id).order('created_at', { ascending: false }).limit(50),
    ])

  // Viewing a provider's license / NPI / documents is PHI-adjacent access.
  await audit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'admin_view_user',
    targetTable: 'profiles',
    targetId: id,
    phiAccessed: Boolean(contractor.data),
  })

  const meta = authUser.user_metadata ?? {}
  const c = contractor.data as Record<string, unknown> | null
  const name =
    (c && `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()) ||
    (facility.data?.facility_name as string | undefined) ||
    (client.data && `${client.data.first_name ?? ''} ${client.data.last_name ?? ''}`.trim()) ||
    `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim() ||
    authUser.email ||
    id
  const role = (profile.data?.role as string | undefined) ?? (meta.role as string | undefined) ?? 'no profile'

  const adminEmails = new Map<string, string>()
  const adminIds = [...new Set((adminLog.data ?? []).map((r) => r.admin_id).filter(Boolean))]
  if (adminIds.length) {
    const { data } = await db.from('profiles').select('id, email').in('id', adminIds)
    for (const p of data ?? []) adminEmails.set(p.id, p.email ?? p.id)
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-[#62646a] hover:text-[#1dbf73]">
        <ArrowLeft className="size-4" /> All users
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#62646a]">
            <Badge variant="outline">{role}</Badge>
            <EmailConfirmedBadge at={authUser.email_confirmed_at ?? null} />
            {c && <VerificationBadge status={c.verification_status as string} />}
            {profile.data?.is_verified && <Badge className="bg-[#e8faf1] text-[#0f8f56]">Account verified</Badge>}
            {profile.data && !profile.data.is_active && <Badge className="bg-red-100 text-red-700">Suspended</Badge>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {profile.data && (
            <AccountActions
              userId={id}
              isActive={Boolean(profile.data.is_active)}
              isVerified={Boolean(profile.data.is_verified)}
            />
          )}
          {c && (
            <Link
              href={`/admin/verification/${id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c3a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0c3d2f]"
            >
              <ShieldCheck className="size-4" /> Open provider verification review
            </Link>
          )}
        </div>
      </div>

      {!profile.data && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">
            This auth account has no row in <code>profiles</code> — the signup trigger failed for this user.
          </CardContent>
        </Card>
      )}

      <Section title="Login & account">
        <FieldGrid
          data={{
            user_id: authUser.id,
            email: authUser.email,
            phone: authUser.phone || profile.data?.phone,
            signed_up_at: authUser.created_at,
            email_confirmed_at: authUser.email_confirmed_at,
            last_sign_in_at: authUser.last_sign_in_at ?? 'Never',
            sign_in_methods: (authUser.identities ?? []).map((i) => i.provider),
            mfa_factors: (authUser.factors ?? []).map((f) => `${f.factor_type} (${f.status})`),
            banned_until: authUser.banned_until,
          }}
        />
      </Section>

      {profile.data && (
        <Section title="Profile">
          <FieldGrid data={profile.data} />
        </Section>
      )}

      {c && (
        <Section title="Provider details">
          <FieldGrid data={c} />
        </Section>
      )}

      {facility.data && (
        <Section title="Facility details">
          <FieldGrid data={facility.data} />
        </Section>
      )}

      {client.data && (
        <Section title="Client details">
          <FieldGrid data={client.data} />
        </Section>
      )}

      {(memberships.data ?? []).length > 0 && (
        <Section title="Organizations">
          <div className="space-y-4">
            {memberships.data!.map((m, i) => (
              <div key={i}>
                <p className="mb-2 text-sm text-[#62646a]">
                  {m.membership_type} · joined {formatDateTime(m.joined_at)}
                </p>
                {m.organizations && <FieldGrid data={m.organizations as unknown as Record<string, unknown>} />}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Signup form data (auth metadata)">
        {Object.keys(meta).length ? <FieldGrid data={meta} /> : <p className="text-sm text-[#6b7280]">None.</p>}
      </Section>

      {c && (
        <Section title={`Credentials & documents (${credentials.data?.length ?? 0})`}>
          {(credentials.data ?? []).length === 0 ? (
            <p className="text-sm text-[#6b7280]">No credentials uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-[#f1f3f5]">
              {credentials.data!.map((cred) => (
                <li key={cred.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-[#404145]">{cred.name} <span className="font-normal text-[#62646a]">({cred.credential_type})</span></p>
                    <p className="text-xs text-[#62646a]">
                      #{cred.license_number ?? '—'} · {cred.issuing_authority ?? '—'} · expires {cred.expiration_date ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{cred.status}</Badge>
                    {cred.document_url && (
                      <a href={credentialDocumentHref(cred.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#1dbf73] hover:underline">
                        View document <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {(checks.data ?? []).length > 0 && (
            <div className="mt-4 border-t border-[#f1f3f5] pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[#9ca3af]">Automated checks</p>
              <ul className="space-y-1 text-sm">
                {checks.data!.map((ch) => (
                  <li key={ch.check_type}>
                    <span className="font-medium">{ch.check_type}</span>: {ch.status}
                    {ch.checked_at ? ` · ${formatRelativeTime(ch.checked_at)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {(applications.data ?? []).length > 0 && (
        <Section title="Job applications">
          <ul className="space-y-1 text-sm">
            {applications.data!.map((a) => (
              <li key={a.id}>{a.status} · {formatDateTime(a.created_at)} · job {a.job_id.slice(0, 8)}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Bug reports from this user">
        {(bugs.data ?? []).length === 0 ? (
          <p className="text-sm text-[#6b7280]">None.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {bugs.data!.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <SeverityBadge severity={b.severity} />
                <BugStatusBadge status={b.status} />
                <Link href={`/admin/bugs?id=${b.id}`} className="text-[#404145] hover:underline">{b.title}</Link>
                <span className="text-xs text-[#6b7280]">{formatRelativeTime(b.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Admin notes & decisions">
        <form action={addAdminNote.bind(null, id)} className="mb-4 flex gap-2">
          <input
            name="note"
            required
            maxLength={2000}
            placeholder="Add an internal note (e.g. called provider, license confirmed on BRN site)…"
            className="h-9 flex-1 rounded-md border border-[#e4e5e7] px-3 text-sm outline-none focus:border-[#1dbf73]"
          />
          <button className="h-9 rounded-md bg-[#1dbf73] px-3 text-sm font-medium text-white hover:bg-[#19a463]">Add note</button>
        </form>
        {(adminLog.data ?? []).length === 0 ? (
          <p className="text-sm text-[#6b7280]">No admin actions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {adminLog.data!.map((row) => (
              <li key={row.id} className="border-l-2 border-[#1dbf73]/40 pl-3">
                <p className="text-[#404145]">
                  <span className="font-medium">{row.action.replaceAll('_', ' ')}</span>
                  {row.notes ? ` — ${row.notes}` : ''}
                </p>
                <p className="text-xs text-[#6b7280]">
                  {adminEmails.get(row.admin_id) ?? 'admin'} · {formatDateTime(row.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="User activity log">
        {(auditLog.data ?? []).length === 0 ? (
          <p className="text-sm text-[#6b7280]">No recorded activity.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {auditLog.data!.map((row) => (
              <li key={row.id} className="flex justify-between gap-4">
                <span>{row.action.replaceAll('_', ' ')}{row.resource_type !== 'system' ? ` · ${row.resource_type}` : ''}</span>
                <span className="text-xs text-[#6b7280]">{row.ip ?? ''} {formatDateTime(row.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
