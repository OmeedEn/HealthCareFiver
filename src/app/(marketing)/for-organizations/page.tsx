import type { Metadata } from 'next'
import {
  BeyondClinicalSection,
  BottomCta,
  OrganizationsSection,
  PageIntro,
  PricingSection,
} from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'For organizations — Sanus',
  description:
    'Hospitals, clinics, practices, and employers find and engage verified health professionals directly — no agency fees.',
}

export default function ForOrganizationsPage() {
  return (
    <>
      <PageIntro
        kicker="For organizations"
        title="Specialized health expertise, without agency markups"
        description="Engage compliance, billing, clinical-leadership, nutrition, and education expertise directly — for a project, a retainer, or a one-time consult."
        primary={{ label: 'Post your project need', href: '/signup?as=organization' }}
        secondary={{ label: 'Browse professionals', href: '/find-care' }}
      />
      <OrganizationsSection />
      <BeyondClinicalSection />
      <PricingSection show="buyers" />
      <BottomCta />
    </>
  )
}
