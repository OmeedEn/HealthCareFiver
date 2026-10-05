import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isDemoMode } from '@/lib/demo/data'
import { formatRelativeTime } from '@/lib/utils/format'
import { INQUIRY_KIND_LABEL, inquirySummary, type InquiryKind } from '@/lib/org/inquiries'
import { InquiryResponseButtons, InquiryToggle } from './inquiry-client'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  facility_id: string
  kind: InquiryKind
  role_title: string
  engagement_type: string
  timeline: string
  message: string | null
  status: 'sent' | 'accepted' | 'declined'
  conversation_id: string | null
  created_at: string
}

/** Inquiries and team invites from organizations (spec). */
export default async function ContractorInquiriesPage() {
  if (isDemoMode()) redirect('/dashboard')
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/contractor/inquiries')

  const [{ data: rows }, { data: me }] = await Promise.all([
    supabase
      .from('org_inquiries')
      .select('id, facility_id, kind, role_title, engagement_type, timeline, message, status, conversation_id, created_at')
      .eq('contractor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('contractor_profiles').select('accepts_inquiries').eq('id', user.id).single(),
  ])
  const inquiries = (rows ?? []) as Row[]
  const orgIds = [...new Set(inquiries.map((i) => i.facility_id))]
  const { data: orgs } = orgIds.length
    ? await supabase.from('facility_profiles').select('id, facility_name, city, state').in('id', orgIds)
    : { data: [] }
  const orgById = new Map((orgs ?? []).map((o) => [o.id, o]))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Inquiries</h1>
        <p className="text-sm text-[#62646a]">Organizations that want to work with you. Accept to start a conversation.</p>
      </div>

      <InquiryToggle initial={me?.accepts_inquiries !== false} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Received ({inquiries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {inquiries.length === 0 ? (
            <p className="text-sm text-[#62646a]">No inquiries yet.</p>
          ) : (
            <ul className="divide-y divide-[#e4e5e7]">
              {inquiries.map((i) => {
                const org = orgById.get(i.facility_id)
                return (
                  <li key={i.id} className="space-y-2 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#404145]">
                          {org?.facility_name || 'An organization'}{' '}
                          <span className="text-xs font-normal text-[#62646a]">
                            {[org?.city, org?.state].filter(Boolean).join(', ')} · {formatRelativeTime(i.created_at)}
                          </span>
                        </p>
                        <p className="text-sm text-[#62646a]">
                          {INQUIRY_KIND_LABEL[i.kind]}: {inquirySummary(i)}
                        </p>
                      </div>
                      <Badge variant={i.status === 'accepted' ? 'default' : 'secondary'}>
                        {i.status === 'sent' ? 'New' : i.status === 'accepted' ? 'Accepted' : 'Declined'}
                      </Badge>
                    </div>
                    {i.message && <p className="whitespace-pre-line rounded-md bg-[#fafafa] p-3 text-sm text-[#404145]">{i.message}</p>}
                    {i.status === 'sent' && <InquiryResponseButtons id={i.id} />}
                    {i.status === 'accepted' && i.conversation_id && (
                      <a href={`/messages/${i.conversation_id}`} className="text-sm font-semibold text-[#1dbf73] hover:underline">
                        Open conversation →
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
