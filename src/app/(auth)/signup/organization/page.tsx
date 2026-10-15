import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { parseOrgSignupSource } from '@/lib/onboarding/org-signup-source'
import { OrganizationSignupForm } from './signup-form'

export const metadata: Metadata = { title: 'Create your organization account — Sanus' }

// The organization flow is reached through a door: /signup/offer (PRACTICE,
// COMPANY) or /signup/looking (HIRING). Without one, start at the router.
export default async function OrganizationSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const source = parseOrgSignupSource((await searchParams).source)
  if (!source) redirect('/signup')
  return <OrganizationSignupForm source={source} />
}
