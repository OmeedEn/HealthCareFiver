import type { Metadata } from 'next'
import { BottomCta, EventsSection, PageIntro } from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'Events & training — Sanus',
  description:
    'Webinars, workshops, CEU and CME courses, and certification programs taught by Sanus health professionals.',
}

export default function EventsAndTrainingPage() {
  return (
    <>
      <PageIntro
        kicker="Events & training"
        title="Learn from verified health professionals"
        description="Live webinars, hands-on workshops, CEU and CME courses, and certification cohorts — created and taught by professionals on Sanus."
        primary={{ label: 'Browse events', href: '/events' }}
        secondary={{ label: 'Host an event', href: '/signup?as=professional' }}
      />
      <EventsSection />
      <BottomCta />
    </>
  )
}
