import { redirect } from 'next/navigation'
import { signupStartUrl } from '@/lib/onboarding/signup-start'

// Professional signup is the Independent path of the one /signup flow.
export default async function ProfessionalSignupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  redirect(signupStartUrl('independent', await searchParams))
}
