import type { Metadata } from 'next'
import { BottomCta, EventsSection, PageIntro } from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'Events & training — Sanus',
  description:
    'Webinars, workshops, continuing-education courses, and certification prep taught by Sanus health professionals.',
}

export default function EventsAndTrainingPage() {
  return (
    <>
      <PageIntro
        kicker="Events & training"
        title="Learn from verified health professionals"
        description="Live webinars, hands-on workshops, continuing-education courses, and certification cohorts — created and taught by professionals on Sanus. CE credit is listed only after Sanus reviews the accreditation."
        primary={{ label: 'Browse events', href: '/find-care?tab=listings&kind=event' }}
        secondary={{ label: 'Host an event', href: '/events-and-training/host' }}
      />
      <EventsSection />
      <BottomCta />
    </>
  )
}
