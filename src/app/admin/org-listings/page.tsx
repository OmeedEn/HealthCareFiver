import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/utils/format'
import { riskyClaimWords } from '@/lib/listings/claims'
import {
  EVENT_AUDIENCES,
  EVENT_FORMATS,
  LISTING_FORMATS,
  ORG_EVENT_TYPES,
  SERVICE_AUDIENCES,
  labelFor,
} from '@/lib/onboarding/organization'
import { reviewOrgListing } from './actions'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  facility_id: string
  kind: 'service' | 'event'
  status: string
  title: string
  description: string | null
  audiences: string[]
  format: string | null
  locations: string | null
  price_cents: number | null
  contact_for_pricing: boolean
  is_free: boolean
  event_type: string | null
  starts_at: string | null
  offers_ceu: boolean | null
  submitted_at: string | null
  facility_profiles: { facility_name: string; verification_status: string; org_agreement_accepted_at: string | null } | null
}

/** Admin review of organization services and events (spec checklist item 9). */
export default async function AdminOrgListingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireAdmin()
  const { status } = await searchParams
  const filter = status === 'published' ? 'published' : 'in_review'

  const { data, error } = await db
    .from('org_listings')
    .select('*, facility_profiles(facility_name, verification_status, org_agreement_accepted_at)')
    .eq('status', filter)
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(300)
  if (error) console.error('[admin/org-listings] load failed', error)
  const rows = (data ?? []) as unknown as Row[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Organization listings</h1>
        <p className="text-sm text-[#62646a]">Services and events organizations submitted. Nothing goes live until it&apos;s published here.</p>
      </div>
      <div className="flex gap-2">
        {(['in_review', 'published'] as const).map((s) => (
          <Link
            key={s}
            href={s === 'in_review' ? '/admin/org-listings' : '/admin/org-listings?status=published'}
            className={`rounded-full border px-3 py-1 text-sm ${filter === s ? 'border-[#1dbf73] bg-[#e8faf1] font-semibold text-[#0f8f56]' : 'border-[#e4e5e7] text-[#62646a]'}`}
          >
            {s === 'in_review' ? 'Awaiting review' : 'Live'}
          </Link>
        ))}
      </div>

      {rows.length === 0 && <p className="text-sm text-[#62646a]">{error ? 'Could not load listings.' : 'Nothing here.'}</p>}

      {rows.map((l) => {
        const org = l.facility_profiles
        const risky = riskyClaimWords(`${l.title}\n${l.description ?? ''}`)
        const price = l.kind === 'service' && l.contact_for_pricing ? 'Contact for pricing' : l.is_free ? 'Free' : l.price_cents == null ? '—' : `$${(l.price_cents / 100).toFixed(2)}`
        return (
          <Card key={l.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {l.title}
                <Badge variant="secondary">{l.kind === 'service' ? 'Service' : labelFor(ORG_EVENT_TYPES, l.event_type)}</Badge>
                {risky.length > 0 && <Badge variant="destructive">Check wording: {risky.join(', ')}</Badge>}
              </CardTitle>
              <p className="text-sm text-[#62646a]">
                <Link href={`/admin/organizations/${l.facility_id}`} className="font-semibold text-[#1dbf73] hover:underline">
                  {org?.facility_name || 'Organization'}
                </Link>{' '}
                · {org?.verification_status} · agreement {org?.org_agreement_accepted_at ? 'accepted' : 'NOT accepted'}
                {l.submitted_at && <> · submitted {formatDateTime(l.submitted_at)}</>}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {l.description && <p className="whitespace-pre-line text-[#404145]">{l.description}</p>}
              <p className="text-[#62646a]">
                {[
                  labelFor(l.kind === 'service' ? LISTING_FORMATS : EVENT_FORMATS, l.format),
                  l.locations,
                  price,
                  l.kind === 'event' ? (l.starts_at ? formatDateTime(l.starts_at) : 'Date to be set') : null,
                  l.kind === 'event' && l.offers_ceu ? 'CEU/CME credit' : null,
                  l.audiences.map((a) => labelFor(l.kind === 'service' ? SERVICE_AUDIENCES : EVENT_AUDIENCES, a)).join(', '),
                ].filter(Boolean).join(' · ')}
              </p>
              <div className="flex flex-wrap items-start gap-3 border-t border-[#f1f3f5] pt-3">
                {filter === 'in_review' && (
                  <form action={reviewOrgListing.bind(null, l.id, 'publish')}>
                    <Button type="submit" className="bg-[#1dbf73] text-white hover:bg-[#19a463]">Publish</Button>
                  </form>
                )}
                <form action={reviewOrgListing.bind(null, l.id, filter === 'in_review' ? 'request_changes' : 'unpublish')} className="flex flex-1 items-start gap-2">
                  <Textarea name="notes" required rows={2} placeholder={filter === 'in_review' ? 'What needs to change (shown to the organization)' : 'Why it’s being unpublished (shown to the organization)'} className="min-w-[240px] flex-1" />
                  <Button type="submit" variant="outline">{filter === 'in_review' ? 'Request changes' : 'Unpublish'}</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
