import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROFILE_NAME_SELECT, profileName, type ProfileWithNames } from '@/lib/profile-name'
import { BOOKING_COLUMNS, type BookingMessage, type BookingRow } from './types'

/** Bookings I made (as a customer), newest first. RLS limits rows. */
export async function listMyBookings(userId: string): Promise<BookingRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('org_bookings')
    .select(BOOKING_COLUMNS)
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as unknown as BookingRow[]
}

/** Bookings for my organization, newest first. RLS limits rows. */
export async function listOrgBookings(orgId: string): Promise<BookingRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('org_bookings')
    .select(BOOKING_COLUMNS)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(300)
  return (data ?? []) as unknown as BookingRow[]
}

/**
 * Display names for the people on bookings. Customers' names live in
 * private role tables the organization can't read, so this uses the
 * service role — only call it with ids from bookings the viewer can see.
 */
export async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = Array.from(new Set(ids)).filter(Boolean)
  if (!unique.length) return out
  const { data } = await createAdminClient().from('profiles').select(PROFILE_NAME_SELECT).in('id', unique)
  for (const p of (data ?? []) as unknown as ProfileWithNames[]) {
    const n = profileName(p)
    out.set(p.id, `${n.first_name} ${n.last_name}`.trim())
  }
  return out
}

export interface BookingDetail {
  booking: BookingRow
  messages: BookingMessage[]
  side: 'customer' | 'org'
  names: Map<string, string>
}

/** One booking with its messages, if the viewer is on it (RLS decides). */
export async function getBookingDetail(id: string, viewerId: string): Promise<BookingDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase.from('org_bookings').select(BOOKING_COLUMNS).eq('id', id).maybeSingle()
  const booking = data as unknown as BookingRow | null
  if (!booking) return null
  const side = booking.customer_id === viewerId ? 'customer' : booking.org_id === viewerId ? 'org' : null
  if (!side) return null
  const { data: msgs } = await supabase
    .from('org_booking_messages')
    .select('id, booking_id, sender_id, body, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })
  const names = await namesFor([booking.customer_id, booking.org_id])
  return { booking, messages: (msgs ?? []) as BookingMessage[], side, names }
}
