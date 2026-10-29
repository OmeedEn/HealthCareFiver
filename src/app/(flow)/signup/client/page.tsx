import { redirect } from 'next/navigation'
import { signupStartUrl } from '@/lib/onboarding/signup-start'

// Client signup is the "Myself or my family" path of the one /signup flow.
export default async function ClientSignupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  redirect(signupStartUrl('client', await searchParams))
}
