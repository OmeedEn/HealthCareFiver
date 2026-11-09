import Link from 'next/link'
import { CalendarDays, ChevronRight, Megaphone, Users } from 'lucide-react'
import { money, statusLabel, statusTone, when, type BookingRow } from '@/lib/bookings/types'

const TONES = {
  green: 'bg-[#eceefe] text-[#2330c8]',
  amber: 'bg-[#fbf0dc] text-[#8a5a00]',
  red: 'bg-[#fdecea] text-[#b42318]',
  gray: 'bg-[#eeebe4] text-[#5f5d57]',
} as const

export function BookingStatusBadge({ booking, side }: { booking: BookingRow; side: 'customer' | 'org' }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[statusTone(booking)]}`}>
      {statusLabel(booking, side)}
    </span>
  )
}

/** One booking as a row linking to its page. */
export function BookingListItem({
  booking: b,
  side,
  counterpart,
}: {
  booking: BookingRow
  side: 'customer' | 'org'
  /** The other party's name (organization for customers, customer for orgs). */
  counterpart: string
}) {
  const s = b.listing_snapshot
  const time = b.kind === 'event' ? when(s.starts_at) : when(b.scheduled_start ?? b.requested_start)
  const Icon = b.kind === 'event' ? CalendarDays : Megaphone
  return (
    <li>
      <Link
        href={`/bookings/${b.id}`}
        className="flex items-center gap-4 rounded-xl border border-[#e3dfd6] bg-white p-4 transition hover:border-[#2f3cf5] hover:bg-[#f4f5fe]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#eceefe] text-[#2f3cf5]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[#1a1a17]">{s.title}</span>
          <span className="mt-0.5 block truncate text-sm text-[#5f5d57]">
            {[counterpart, time ?? (b.kind === 'service' ? 'Flexible time' : 'Date to be announced'), money(b.price_cents)]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {b.kind === 'event' && b.quantity > 1 && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#5f5d57]">
              <Users className="size-3" aria-hidden="true" /> {b.quantity} spots
            </span>
          )}
        </span>
        <BookingStatusBadge booking={b} side={side} />
        <ChevronRight className="size-4 shrink-0 text-[#706d65]" aria-hidden="true" />
      </Link>
    </li>
  )
}

export function BookingGroup({ title, children, count }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#5f5d57]">
        {title} <span className="text-[#706d65]">({count})</span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}
