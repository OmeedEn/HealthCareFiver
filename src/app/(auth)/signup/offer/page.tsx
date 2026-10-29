import { redirect } from 'next/navigation'
import { signupStartUrl } from '@/lib/onboarding/signup-start'

// Old screen 2A of signup routing; now a screen of the one /signup flow.
export default async function SignupOfferRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  redirect(signupStartUrl('offer', await searchParams))
}
