import { redirect } from 'next/navigation'

// Bookings live at /bookings for everyone now (clients, and professionals in
// browse mode).
export default function BrowseBookingsRedirect() {
  redirect('/bookings')
}
