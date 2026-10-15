import type { Metadata } from 'next'
import { connection } from 'next/server'
import { isDemoMode } from '@/lib/demo/data'
import { getPublicOrgListings } from '@/lib/orgs/public'
import { OrgListingsPanel } from '@/app/find-care/org-listings-panel'
import { DemoEvents } from './demo-events'

export const metadata: Metadata = { title: 'Events & training — Sanus' }

/**
 * Upcoming events and trainings from verified organizations (published
 * org_listings). Registration goes through Sanus; the button says so until
 * bookings ship. Demo mode keeps the fictional sample events.
 */
export default async function EventsPage() {
  if (isDemoMode()) return <DemoEvents />
  await connection()
  const events = await getPublicOrgListings('event')

  return (
    <div className="space-y-2">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#111827]">Events &amp; training</h1>
        <p className="mt-1 text-[#6b7280]">
          Webinars, workshops, CEU courses, and certifications from verified organizations.
        </p>
      </div>
      {/* Inside the app the viewer is signed in (the proxy enforces MFA here). */}
      <OrgListingsPanel listings={events} signedIn onlyKind="event" />
    </div>
  )
}
