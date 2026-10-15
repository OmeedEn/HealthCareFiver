import type { Metadata } from 'next'
import { Building2, HeartHandshake } from 'lucide-react'
import { SignupBackLink, SignupDoorTiles, type SignupDoor } from '@/components/auth/signup-doors'
import { SignupScreenView } from '@/components/auth/signup-tracking'

export const metadata: Metadata = { title: 'Who is this for? — Sanus' }

// Screen 2B of signup routing: a client for themselves, or an organization
// that's hiring (the HIRING door of the organization flow).

const DOORS: SignupDoor[] = [
  {
    option: 'client',
    href: '/signup/client',
    icon: HeartHandshake,
    title: 'Myself or my family',
    description: 'Find care, coaching, or guidance, or attend an event.',
  },
  {
    option: 'hiring',
    href: '/signup/organization?source=HIRING',
    icon: Building2,
    title: 'My organization or business',
    description: 'Hire or book professionals, post an urgent need, or find experts for your team.',
  },
]

export default function SignupLookingPage() {
  return (
    <div>
      <SignupScreenView screen="looking" />
      <SignupBackLink href="/signup" />

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#404145]">Who is this for?</h1>

      <SignupDoorTiles screen="looking" doors={DOORS} />
    </div>
  )
}
