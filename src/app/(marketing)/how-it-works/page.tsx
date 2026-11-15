import type { Metadata } from 'next'
import {
  BottomCta,
  HowItWorksSection,
  PageIntro,
  PricingSection,
  TrustSection,
} from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'How it works — Sanus',
  description:
    'How finding and booking health professionals works on Sanus, how professionals are reviewed before they can be booked, and where payments stand.',
}

export default function HowItWorksPage() {
  return (
    <>
      <PageIntro
        kicker="How it works"
        title="Three audiences, one platform"
        description="Individuals and organizations find and book reviewed professionals. Professionals list what they offer and set up payouts through Stripe."
        primary={{ label: 'Find a professional', href: '/find-care' }}
        secondary={{ label: 'Join Sanus', href: '/signup' }}
      />
      <HowItWorksSection />
      <TrustSection />
      <PricingSection />
      <BottomCta />
    </>
  )
}
