import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { CalendarCheck } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { currentUser } from '@/lib/auth/roles'
import { listMyBookings, namesFor } from '@/lib/bookings/data'
import { needsPayment, type BookingRow } from '@/lib/bookings/types'
import { BookingGroup, BookingListItem } from '@/components/bookings/booking-list'

export const metadata: Metadata = { title: 'My bookings — Sanus' }

/** Services and events you requested or booked, as a customer. */
export default async function MyBookingsPage() {
  await connection()
  let bookings: BookingRow[] = []
  let names = new Map<string, string>()
  if (!isDemoMode()) {
    const user = await currentUser()
    if (!user) redirect('/login?redirectTo=/bookings')
    bookings = await listMyBookings(user.id)
    names = await namesFor(bookings.map((b) => b.org_id))
  }
  const by = (statuses: string[]) => bookings.filter((b) => statuses.includes(b.status))
  const action = bookings.filter((b) => b.status === 'quoted' || needsPayment(b))
  const waiting = by(['requested'])
  const booked = bookings.filter((b) => (b.status === 'accepted' && !needsPayment(b)) || b.status === 'paid')
  const closed = by(['completed', 'declined', 'cancelled'])
  const item = (b: BookingRow) => (
    <BookingListItem key={b.id} booking={b} side="customer" counterpart={names.get(b.org_id) ?? b.listing_snapshot.org_name ?? ''} />
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a17]">My bookings</h1>
        <p className="text-sm text-[#5f5d57]">
          Services you’ve requested and events you’ve registered for. Everything, including messages, stays on Sanus.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#cbc6ba] bg-white py-14 text-center">
          <CalendarCheck className="size-10 text-[#cbc6ba]" aria-hidden="true" />
          <p className="font-semibold text-[#1a1a17]">No bookings yet</p>
          <p className="max-w-sm text-sm text-[#5f5d57]">Find a service or event and request it. It will show up here.</p>
          <div className="flex gap-4 text-sm font-semibold">
            <Link href="/find-care?tab=listings" className="text-[#2f3cf5] hover:underline">Services &amp; events</Link>
            <Link href="/events" className="text-[#2f3cf5] hover:underline">Events &amp; training</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <BookingGroup title="Needs your answer" count={action.length}>{action.map(item)}</BookingGroup>
          <BookingGroup title="Waiting for the organization" count={waiting.length}>{waiting.map(item)}</BookingGroup>
          <BookingGroup title="Booked" count={booked.length}>{booked.map(item)}</BookingGroup>
          <BookingGroup title="Past and closed" count={closed.length}>{closed.map(item)}</BookingGroup>
        </div>
      )}
    </div>
  )
}
