import { CalendarDays, Clock, MapPin, Users, Video } from 'lucide-react'
import {
  KIND_LABELS,
  eventTypeLabel,
  engagementLabel,
  formatLabel,
  priceLine,
  type ListingRow,
} from '@/lib/listings/offering'

/** A listing exactly as clients see it (no internal status, notes, or flags). */
export type PublicListing = Pick<
  ListingRow,
  | 'id'
  | 'kind'
  | 'title'
  | 'description'
  | 'format'
  | 'duration_minutes'
  | 'engagement_type'
  | 'custom_quote'
  | 'event_type'
  | 'starts_at'
  | 'capacity'
  | 'price_cents'
  | 'is_free'
>

export function toPublicListing(l: ListingRow): PublicListing {
  return {
    id: l.id,
    kind: l.kind,
    title: l.title,
    description: l.description,
    format: l.format,
    duration_minutes: l.duration_minutes,
    engagement_type: l.engagement_type,
    custom_quote: l.custom_quote,
    event_type: l.event_type,
    starts_at: l.starts_at,
    capacity: l.capacity,
    price_cents: l.price_cents,
    is_free: l.is_free,
  }
}

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

export function ListingCard({
  listing,
  footer,
}: {
  listing: PublicListing
  footer?: React.ReactNode
}) {
  const l = listing
  const kindLine =
    l.kind === 'service'
      ? formatLabel(l.format)
      : l.kind === 'consulting'
        ? engagementLabel(l.engagement_type)
        : eventTypeLabel(l.event_type)

  return (
    <article className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#6b7280]">
        <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-[#374151]">
          {KIND_LABELS[l.kind]}
        </span>
        {kindLine && <span>{kindLine}</span>}
      </div>
      <h3 className="mt-2 text-base font-semibold text-[#111827]">{l.title}</h3>
      {l.description && (
        <p className="mt-1.5 whitespace-pre-line text-sm text-[#374151]">
          {l.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#6b7280]">
        <span className="font-semibold text-[#1dbf73]">{priceLine(l)}</span>
        {l.kind === 'service' && l.duration_minutes && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {l.duration_minutes} min
          </span>
        )}
        {l.kind === 'service' && l.format === 'virtual' && (
          <span className="inline-flex items-center gap-1">
            <Video className="size-3.5" aria-hidden="true" />
            Video visit
          </span>
        )}
        {l.kind === 'service' &&
          (l.format === 'in_person' || l.format === 'home_visit') && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {l.format === 'home_visit' ? 'Comes to you' : 'In person'}
            </span>
          )}
        {l.kind === 'event' && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {l.starts_at ? formatWhen(l.starts_at) : 'Date to be announced'}
          </span>
        )}
        {l.kind === 'event' && l.capacity && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            Up to {l.capacity}
          </span>
        )}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </article>
  )
}
