import Link from 'next/link'
import { Award, Building2, CalendarDays, MapPin, Users, Video } from 'lucide-react'
import {
  EVENT_AUDIENCES,
  EVENT_FORMATS,
  LISTING_FORMATS,
  ORG_EVENT_TYPES,
  SERVICE_AUDIENCES,
  labelFor,
} from '@/lib/onboarding/organization'
import type { PublicOrgListing, PublicOrgListingWithOrg } from '@/lib/orgs/public'
import { RequestBookingButton } from '@/components/bookings/request-booking-button'

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  })
}

export function orgListingPrice(l: PublicOrgListing): string {
  if (l.kind === 'service' && l.contactForPricing) return 'Request a quote'
  if (l.kind === 'event' && l.isFree) return 'Free'
  if (l.priceCents == null) return 'Price on request'
  return `$${(l.priceCents / 100).toFixed(2).replace(/\.00$/, '')}`
}

/** A published organization service or event, as the public sees it. */
export function OrgListingCard({
  listing,
  showOrg = false,
  footer,
}: {
  listing: PublicOrgListing | PublicOrgListingWithOrg
  /** Show which organization offers it (Find care, Events). */
  showOrg?: boolean
  footer?: React.ReactNode
}) {
  const l = listing
  const org = 'org' in l ? l.org : null
  const kindLine = l.kind === 'event' ? labelFor(ORG_EVENT_TYPES, l.eventType) : 'Service'
  const formatLine = labelFor(l.kind === 'event' ? EVENT_FORMATS : LISTING_FORMATS, l.format)
  const audiences = l.audiences
    .map((a) => labelFor(l.kind === 'event' ? EVENT_AUDIENCES : SERVICE_AUDIENCES, a))
    .filter(Boolean)

  return (
    <article id={`listing-${l.id}`} className="flex scroll-mt-24 flex-col rounded-2xl border border-[#e5e7eb] bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#6b7280]">
        <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-[#374151]">{kindLine}</span>
        {l.kind === 'event' && l.offersCeu && (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#eef6ff] px-2 py-0.5 text-[#1e5aa8]">
            <Award className="size-3" aria-hidden="true" />
            CEU/CME credit
          </span>
        )}
      </div>
      <h3 className="mt-2 text-base font-semibold text-[#111827]">{l.title}</h3>
      {showOrg && org && (
        <Link
          href={`/orgs/${org.id}`}
          className="mt-0.5 inline-flex w-fit items-center gap-1 text-sm font-medium text-[#0f8f56] hover:underline"
        >
          <Building2 className="size-3.5" aria-hidden="true" />
          {org.name}
        </Link>
      )}
      {l.description && (
        <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm text-[#374151]">{l.description}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#6b7280]">
        <span className="font-semibold text-[#1dbf73]">{orgListingPrice(l)}</span>
        {l.kind === 'event' && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {l.startsAt ? formatWhen(l.startsAt) : 'Date to be announced'}
          </span>
        )}
        {formatLine && (
          <span className="inline-flex items-center gap-1">
            {l.format === 'virtual' ? (
              <Video className="size-3.5" aria-hidden="true" />
            ) : (
              <MapPin className="size-3.5" aria-hidden="true" />
            )}
            {l.format === 'virtual' ? formatLine : [formatLine, l.locations].filter(Boolean).join(' · ')}
          </span>
        )}
        {l.kind === 'event' && l.capacity && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            Up to {l.capacity}
          </span>
        )}
      </div>
      {audiences.length > 0 && <p className="mt-1.5 text-xs text-[#6b7280]">For {audiences.join(', ').toLowerCase()}</p>}
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </article>
  )
}

/**
 * Booking button. Logged out: sign up first. Signed in: request it through
 * Sanus (request → the organization accepts or quotes → pay).
 */
export function OrgListingCta({ listing, signedIn }: { listing: PublicOrgListing; signedIn: boolean }) {
  const quote = listing.kind === 'service' && (listing.contactForPricing || listing.reachVia === 'inquiry')
  const verb = quote ? 'request a quote' : listing.kind === 'event' ? 'register' : 'book'
  if (!signedIn) {
    return (
      <Link
        href="/signup/looking"
        className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#1dbf73] text-sm font-semibold text-[#1dbf73] transition hover:bg-[#1dbf73] hover:text-white"
      >
        Sign up to {verb}
      </Link>
    )
  }
  return <RequestBookingButton listing={listing} />
}
