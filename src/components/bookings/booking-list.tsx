import Link from 'next/link'
import { CalendarDays, ChevronRight, Megaphone, Users } from 'lucide-react'
import { money, statusLabel, statusTone, when, type BookingRow, type BookingStatus } from '@/lib/bookings/types'

const TONES = {
  green: 'bg-[#e8faf1] text-[#0f8f56]',
  amber: 'bg-[#fdf6e3] text-[#8a6d0b]',
  red: 'bg-[#fdecea] text-[#b42318]',
  gray: 'bg-[#f1f1f2] text-[#62646a]',
} as const

export function BookingStatusBadge({ status, side }: { status: BookingStatus; side: 'customer' | 'org' }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[statusTone(status)]}`}>
      {statusLabel(status, side)}
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
        className="flex items-center gap-4 rounded-xl border border-[#e4e5e7] bg-white p-4 transition hover:border-[#1dbf73] hover:bg-[#fafefb]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[#404145]">{s.title}</span>
          <span className="mt-0.5 block truncate text-sm text-[#62646a]">
            {[counterpart, time ?? (b.kind === 'service' ? 'Flexible time' : 'Date to be announced'), money(b.price_cents)]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {b.kind === 'event' && b.quantity > 1 && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#62646a]">
              <Users className="size-3" aria-hidden="true" /> {b.quantity} spots
            </span>
          )}
        </span>
        <BookingStatusBadge status={b.status} side={side} />
        <ChevronRight className="size-4 shrink-0 text-[#95979d]" aria-hidden="true" />
      </Link>
    </li>
  )
}

export function BookingGroup({ title, children, count }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#62646a]">
        {title} <span className="text-[#95979d]">({count})</span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}
