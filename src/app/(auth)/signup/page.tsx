import type { Metadata } from 'next'
import { HandHeart, Search } from 'lucide-react'
import { SignupDoorTiles, SignInFooter, type SignupDoor } from '@/components/auth/signup-doors'
import { SignupScreenView } from '@/components/auth/signup-tracking'

export const metadata: Metadata = { title: 'Join Sanus' }

// Screen 1 of signup routing: offer vs. looking. The next screen decides the
// door (profiles.signup_path); see src/lib/onboarding/signup-path.ts.

const DOORS: SignupDoor[] = [
  {
    option: 'offer',
    href: '/signup/offer',
    icon: HandHeart,
    title: 'I offer services or expertise',
    description:
      'List your services, consulting, or events. For independent professionals, practices, and companies.',
  },
  {
    option: 'looking',
    href: '/signup/looking',
    icon: Search,
    title: "I'm looking for a professional",
    description: 'Find and book experts, attend events, or hire for your organization.',
  },
]

export default function SignupPage() {
  return (
    <div>
      <SignupScreenView screen="signup" />
      <h1 className="text-2xl font-bold tracking-tight text-[#404145]">Join Sanus</h1>
      <p className="mt-2 text-sm text-[#62646a]">What brings you here?</p>

      <SignupDoorTiles screen="signup" doors={DOORS} />

      <SignInFooter />
    </div>
  )
}
