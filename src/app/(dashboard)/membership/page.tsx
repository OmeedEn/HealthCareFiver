import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BadgeCheck, Receipt, UserPlus } from 'lucide-react'

// Professionals no longer pay a subscription. This page (kept at /membership so
// old links work) just explains how Sanus pricing works.
const POINTS = [
  {
    icon: UserPlus,
    title: 'Free to join',
    body: 'Creating your account, credential verification, and going live cost nothing. There is no monthly plan.',
  },
  {
    icon: Receipt,
    title: 'A small service fee per booking',
    body: 'Sanus charges a small service fee on each booking. You’ll see the exact amount before you publish a service, consulting offer, or event.',
  },
  {
    icon: BadgeCheck,
    title: 'Enhanced Verified badge (coming later)',
    body: 'An optional badge with an added background check will be available later. It is never required to join, go live, or get booked.',
  },
] as const

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#1a1a17]">
          How Sanus pricing works
        </h1>
        <p className="mt-1 text-[#5f5d57]">
          Free to join. A small service fee applies to each booking.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg text-[#1a1a17]">
            For professionals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eceefe]">
                <Icon className="h-4 w-4 text-[#2f3cf5]" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-[#1a1a17]">{title}</p>
                <p className="text-sm text-[#5f5d57]">{body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-[#5f5d57]">
        Payouts are handled securely through Stripe. Set them up on your{' '}
        <Link
          href="/contractor/payments"
          className="font-medium text-[#1a1a17] underline underline-offset-2"
        >
          Payments
        </Link>{' '}
        page.
      </p>
    </div>
  )
}
