import { redirect } from 'next/navigation'
import { signupStartUrl } from '@/lib/onboarding/signup-start'

// Old screen 2B of signup routing; now a screen of the one /signup flow.
export default async function SignupLookingRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  redirect(signupStartUrl('looking', await searchParams))
}
