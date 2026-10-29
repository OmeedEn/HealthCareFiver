import { redirect } from 'next/navigation'
import { signupStartUrl } from '@/lib/onboarding/signup-start'

// Not sure signup is the "Not sure" path of the one /signup flow.
export default async function UnsureSignupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  redirect(signupStartUrl('unsure', await searchParams))
}
