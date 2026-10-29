import { redirect } from 'next/navigation'
import { parseOrgSignupSource } from '@/lib/onboarding/org-signup-source'
import { parseSignupStart, signupStartUrl } from '@/lib/onboarding/signup-start'

// Organization signup is the Practice / Company / Hiring path of the one
// /signup flow. Without a valid door, start at the first screen.
export default async function OrganizationSignupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const source = parseOrgSignupSource(params.source)
  redirect(signupStartUrl(source ? parseSignupStart(source.toLowerCase()) : null, params, ['source']))
}
