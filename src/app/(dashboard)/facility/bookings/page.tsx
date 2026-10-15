import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Inbox } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { currentUser } from '@/lib/auth/roles'
import { listOrgBookings, namesFor } from '@/lib/bookings/data'
import type { BookingRow } from '@/lib/bookings/types'
import { BookingGroup, BookingListItem } from '@/components/bookings/booking-list'

export const metadata: Metadata = { title: 'Bookings — Sanus' }

/** Organization inbox: booking requests and registrations for your listings. */
export default async function OrgBookingsPage() {
  await connection()
  let bookings: BookingRow[] = []
  let names = new Map<string, string>()
  if (!isDemoMode()) {
    const user = await currentUser()
    if (!user) redirect('/login?redirectTo=/facility/bookings')
    bookings = await listOrgBookings(user.id)
    names = await namesFor(bookings.map((b) => b.customer_id))
  }
  const by = (statuses: string[]) => bookings.filter((b) => statuses.includes(b.status))
  const needs = by(['requested'])
  const quoted = by(['quoted'])
  const booked = by(['accepted'])
  const closed = by(['declined', 'cancelled'])
  const item = (b: BookingRow) => (
    <BookingListItem key={b.id} booking={b} side="org" counterpart={names.get(b.customer_id) ?? 'Customer'} />
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Bookings</h1>
        <p className="text-sm text-[#62646a]">
          Requests and registrations for your services and events. Accept, send a quote, or decline, and message
          customers right here.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#d5d6d9] bg-white py-14 text-center">
          <Inbox className="size-10 text-[#c5c6c9]" aria-hidden="true" />
          <p className="font-semibold text-[#404145]">No booking requests yet</p>
          <p className="max-w-sm text-sm text-[#62646a]">
            When someone requests one of your live services or events, it lands here and we notify you.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <BookingGroup title="Needs your response" count={needs.length}>{needs.map(item)}</BookingGroup>
          <BookingGroup title="Quote sent" count={quoted.length}>{quoted.map(item)}</BookingGroup>
          <BookingGroup title="Booked" count={booked.length}>{booked.map(item)}</BookingGroup>
          <BookingGroup title="Closed" count={closed.length}>{closed.map(item)}</BookingGroup>
        </div>
      )}
    </div>
  )
}
