import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Booking Terms (Draft) — Sanus',
  description: 'Draft terms for booking services and events on Sanus. Pending legal review.',
}

const linkClass = 'text-[#0f8f56] underline'

const sections: LegalSection[] = [
  {
    id: 'how-it-works',
    title: 'How booking works',
    body: (
      <>
        <p>
          When you request a service or register for an event, the organization offering it reviews
          your request. They can accept it, send you a quote, or decline. Nothing is booked, and you
          aren&apos;t charged, until the organization accepts (or you accept their quote) and you
          complete payment on Sanus.
        </p>
        <p>
          The organization, not Sanus, provides the service or runs the event and is responsible for
          it. Sanus provides the marketplace, verifies organizations before they can list, and holds
          payment until after the booking takes place.
        </p>
      </>
    ),
  },
  {
    id: 'on-sanus',
    title: 'Keep booking, payment, and messages on Sanus',
    body: (
      <>
        <p>
          Book, pay, and message through Sanus. That&apos;s what lets us protect you: your payment is
          held until the booking happens, and there&apos;s a record if something goes wrong. Don&apos;t
          share phone numbers, email addresses, or links in booking notes or messages, and don&apos;t
          arrange to pay outside Sanus.
        </p>
      </>
    ),
  },
  {
    id: 'payment',
    title: 'Payment',
    body: (
      <>
        <p>
          You pay through Sanus after the organization accepts your booking (or you accept their
          quote). You pay the price shown; there&apos;s no extra charge to you. Sanus holds your
          payment and releases it to the organization 48 hours after the booking takes place, minus
          the Sanus service fee, which the organization pays.
        </p>
        <p>
          If an accepted booking isn&apos;t paid by its start time, it&apos;s cancelled and the spot is
          released.
        </p>
      </>
    ),
  },
  {
    id: 'cancellations',
    title: 'Cancellations and refunds',
    body: (
      <>
        <p>
          <strong>You cancel 48 hours or more before the start:</strong> full refund.
        </p>
        <p>
          <strong>You cancel less than 48 hours before the start:</strong> no refund. The organization
          is still paid.
        </p>
        <p>
          <strong>The organization cancels:</strong> full refund, at any time.
        </p>
        <p>
          You can cancel a request, or a booking you haven&apos;t paid for, at any time from My
          bookings at no cost. Refunds go back to the card you paid with and can take 5–10 business
          days to appear. If something went wrong with a booking, contact Sanus support within 48
          hours of it; disputed payments are held until they&apos;re resolved.
        </p>
      </>
    ),
  },
  {
    id: 'health',
    title: 'Health information',
    body: (
      <p>
        Only share the health information the organization needs to schedule and provide your
        service. In an emergency, call 911. Bookings on Sanus aren&apos;t for urgent or emergency care.
      </p>
    ),
  },
  {
    id: 'more',
    title: 'Everything else',
    body: (
      <p>
        These terms supplement our <Link href="/terms" className={linkClass}>Terms of Service</Link>{' '}
        and <Link href="/privacy" className={linkClass}>Privacy Policy</Link>. [Disputes, limitation
        of liability, and governing law — pending counsel.]
      </p>
    ),
  },
]

export default function BookingTermsPage() {
  return (
    <LegalPage
      title="Booking Terms"
      lastUpdated="October 15, 2026"
      intro={
        <p>
          These terms apply each time you request a service or register for an event from an
          organization on Sanus.
        </p>
      }
      sections={sections}
    />
  )
}
