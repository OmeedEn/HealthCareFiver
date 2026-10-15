import type { Metadata } from 'next'
import { ArrowRight, Briefcase, Building2, Stethoscope } from 'lucide-react'
import { SignupBackLink, SignupDoorTiles, type SignupDoor } from '@/components/auth/signup-doors'
import { SignupOptionLink, SignupScreenView } from '@/components/auth/signup-tracking'

export const metadata: Metadata = { title: 'How do you work? — Sanus' }

// Screen 2A of signup routing: which kind of provider. "Not sure" is kept
// visually secondary so it doesn't become the default pick.

const DOORS: SignupDoor[] = [
  {
    option: 'independent',
    href: '/signup/professional',
    icon: Stethoscope,
    title: 'Independent professional',
    description:
      'I work for myself. Solo practitioner, freelancer, consultant, coach, or educator offering my own services, consulting, or events.',
  },
  {
    option: 'practice',
    href: '/signup/organization?source=PRACTICE',
    icon: Building2,
    title: 'Practice, clinic, or facility',
    description:
      'We have a location and a team. Hospital, clinic, med spa, gym, wellness center, school, or nonprofit.',
  },
  {
    option: 'company',
    href: '/signup/organization?source=COMPANY',
    icon: Briefcase,
    title: 'Company or firm',
    description:
      "We sell expertise or training, but we're not a facility. Consulting, law, billing, or training firm, health tech vendor, or recruiting agency.",
  },
]

export default function SignupOfferPage() {
  return (
    <div>
      <SignupScreenView screen="offer" />
      <SignupBackLink href="/signup" />

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#404145]">How do you work?</h1>
      <p className="mt-2 text-sm text-[#62646a]">
        Pick the one that fits best. This decides which questions we ask next.
      </p>

      <SignupDoorTiles screen="offer" doors={DOORS} />

      <SignupOptionLink
        screen="offer"
        option="unsure"
        href="/signup/unsure"
        className="group mt-5 flex items-start gap-3 rounded-xl border border-dashed border-[#e4e5e7] px-4 py-3 transition hover:border-[#1dbf73] hover:bg-[#f0faf5]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#404145]">Not sure</p>
          <p className="mt-0.5 text-xs text-[#62646a]">
            Not sure which fits? That&apos;s okay. Tell us a little about what you do and we&apos;ll
            place you in the right category.
          </p>
        </div>
        <ArrowRight className="mt-1 size-3.5 shrink-0 text-[#62646a] transition group-hover:text-[#1dbf73]" />
      </SignupOptionLink>
    </div>
  )
}
