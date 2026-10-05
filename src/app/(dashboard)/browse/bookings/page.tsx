import Link from 'next/link'
import { CalendarCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/** Browse mode: your own bookings, events and orders as a client. */
export default function MyBookingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">My bookings</h1>
        <p className="text-sm text-[#62646a]">
          Services you book and events you register for as a client. These are private — your public
          profile only shows what you choose to share.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CalendarCheck className="size-10 text-[#c5c6c9]" />
          <p className="font-semibold text-[#404145]">Booking on Sanus is coming soon</p>
          <p className="max-w-sm text-sm text-[#62646a]">
            In the meantime you can browse professionals and events. Payment details are entered at
            checkout, never during signup.
          </p>
          <div className="flex gap-4 text-sm font-semibold">
            <Link href="/browse" className="text-[#1dbf73] hover:underline">Find professionals</Link>
            <Link href="/events" className="text-[#1dbf73] hover:underline">Events & trainings</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
