import type { Metadata } from 'next'
import {
  BottomCta,
  PageIntro,
  PricingSection,
  ProfessionalsSection,
} from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'For professionals — Sanus',
  description:
    'List services, consulting, and events from one reviewed profile. Free to join; payout setup through Stripe.',
}

export default function ForProfessionalsPage() {
  return (
    <>
      <PageIntro
        kicker="For professionals"
        title="Grow your practice beyond your own network"
        description="Reach individuals, businesses, and healthcare organizations from one reviewed profile — services, consulting, and continuing education."
        primary={{ label: 'Offer your expertise', href: '/signup/offer' }}
        secondary={{ label: 'See pricing', href: '#pricing' }}
      />
      <ProfessionalsSection />
      <PricingSection show="professionals" />
      <BottomCta />
    </>
  )
}
