import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isDemoMode } from '@/lib/demo/data'
import { formatDateTime } from '@/lib/utils/format'
import {
  EVENT_AUDIENCES,
  LISTING_FORMATS,
  EVENT_FORMATS,
  ORG_EVENT_TYPES,
  SERVICE_AUDIENCES,
  labelFor,
} from '@/lib/onboarding/organization'
import { AddListing, DeleteListingButton } from './listings-client'

export const dynamic = 'force-dynamic'

interface Listing {
  id: string
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
  capacity: number | null
  offers_ceu: boolean | null
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', in_review: 'In review', published: 'Live' }

function price(l: Listing): string {
  if (l.kind === 'service' && l.contact_for_pricing) return 'Contact us for pricing'
  if (l.kind === 'event' && l.is_free) return 'Free'
  return l.price_cents == null ? '—' : `$${(l.price_cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

/** Organization services and events (spec step 5 A/B, and later from the dashboard). */
export default async function FacilityListingsPage() {
  if (isDemoMode()) redirect('/dashboard')
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/facility/listings')

  const [{ data: rows }, { data: org }] = await Promise.all([
    supabase.from('org_listings').select('*').eq('facility_id', user.id).order('created_at', { ascending: false }),
    supabase.from('facility_profiles').select('verification_status').eq('id', user.id).maybeSingle(),
  ])
  const listings = (rows ?? []) as Listing[]
  const approved = org?.verification_status === 'approved'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Services & events</h1>
        <p className="text-sm text-[#62646a]">
          {approved
            ? 'Listings are saved as drafts. Publishing opens once listing review launches — we’ll let you know.'
            : 'Save listings as drafts now. Nothing goes live until your organization is approved.'}
        </p>
      </div>

      <AddListing />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your listings ({listings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <p className="text-sm text-[#62646a]">Nothing yet. Add a service or an event above.</p>
          ) : (
            <ul className="divide-y divide-[#e4e5e7]">
              {listings.map((l) => (
                <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#404145]">
                      {l.title}{' '}
                      <span className="text-xs font-normal text-[#62646a]">
                        {l.kind === 'service' ? 'Service' : labelFor(ORG_EVENT_TYPES, l.event_type)}
                      </span>
                    </p>
                    <p className="text-sm text-[#62646a]">
                      {[
                        labelFor(l.kind === 'service' ? LISTING_FORMATS : EVENT_FORMATS, l.format),
                        l.locations,
                        price(l),
                        l.kind === 'event' ? (l.starts_at ? formatDateTime(l.starts_at) : 'Date to be set') : null,
                        l.kind === 'event' && l.offers_ceu ? 'CEU/CME credit' : null,
                        l.audiences
                          .map((a) => labelFor(l.kind === 'service' ? SERVICE_AUDIENCES : EVENT_AUDIENCES, a))
                          .join(', '),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={l.status === 'published' ? 'default' : 'secondary'}>
                      {STATUS_LABEL[l.status] ?? l.status}
                    </Badge>
                    {l.status === 'draft' && <DeleteListingButton id={l.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
