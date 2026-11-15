import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { isDemoMode } from '@/lib/demo/data'
import { getPublicOrgListings, type PublicOrgListingWithOrg } from '@/lib/orgs/public'
import { EVENT_FORMATS, ORG_EVENT_TYPES, labelFor } from '@/lib/onboarding/organization'
import { OrgListingsPanel } from '@/app/find-care/org-listings-panel'
import { DemoEvents } from './demo-events'

export const metadata: Metadata = { title: 'Events & training — Sanus' }

/**
 * `?type=` filters from the marketing event links: an event type
 * (ORG_EVENT_TYPES), a format (EVENT_FORMATS), or `free`. Unknown values
 * show everything.
 */
function eventFilter(type: string | undefined): { label: string; test: (l: PublicOrgListingWithOrg) => boolean } | null {
  if (!type) return null
  if (type === 'free') return { label: 'Free', test: (l) => l.isFree }
  if (ORG_EVENT_TYPES.some((t) => t.value === type)) {
    return { label: labelFor(ORG_EVENT_TYPES, type) ?? type, test: (l) => l.eventType === type }
  }
  if (EVENT_FORMATS.some((f) => f.value === type)) {
    return { label: labelFor(EVENT_FORMATS, type) ?? type, test: (l) => l.format === type }
  }
  return null
}

/**
 * Upcoming events and trainings from verified organizations (published
 * org_listings). Signed in (the proxy enforces it): Register opens the
 * request flow through Sanus. Demo mode keeps the fictional sample events.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  if (isDemoMode()) return <DemoEvents />
  await connection()
  const { type } = await searchParams
  const filter = eventFilter(typeof type === 'string' ? type : undefined)
  const all = await getPublicOrgListings('event')
  const events = filter ? all.filter(filter.test) : all

  return (
    <div className="space-y-2">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#1a1a17]">Events &amp; training</h1>
        <p className="mt-1 text-[#5f5d57]">
          Webinars, workshops, courses, and certification prep from verified organizations. Continuing-education
          credit is shown only where Sanus has reviewed the accreditation.
        </p>
        {filter && (
          <p className="mt-2 text-sm text-[#5f5d57]">
            Showing: <span className="font-semibold text-[#1a1a17]">{filter.label}</span> ·{' '}
            <Link href="/events" className="font-semibold text-[#2f3cf5] hover:underline">
              Show all events
            </Link>
          </p>
        )}
      </div>
      {/* Inside the app the viewer is signed in (the proxy enforces MFA here). */}
      <OrgListingsPanel listings={events} signedIn onlyKind="event" />
    </div>
  )
}
