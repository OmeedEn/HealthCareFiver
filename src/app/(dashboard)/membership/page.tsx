import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Receipt, UserPlus } from 'lucide-react'
import { FEE_DISCLOSURE, PAYMENTS_NOT_OPEN, PRICING_HEADLINE } from '@/lib/fees'

// Professionals no longer pay a subscription. This page (kept at /membership so
// old links work) just explains how Ocora pricing works.
const POINTS = [
  {
    icon: UserPlus,
    title: 'Free to join',
    body: 'Creating your account, credential review, and going live cost nothing. There is no monthly plan.',
  },
  {
    icon: Receipt,
    title: 'No service fee set',
    body: `${PAYMENTS_NOT_OPEN} ${FEE_DISCLOSURE}`,
  },
] as const

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#1a1a17]">
          How Ocora pricing works
        </h1>
        <p className="mt-1 text-[#5f5d57]">
          {PRICING_HEADLINE} {PAYMENTS_NOT_OPEN}
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
        Payout setup is handled through Stripe. Set it up on your{' '}
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
