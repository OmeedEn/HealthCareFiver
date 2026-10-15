import type { Metadata } from 'next'
import { connection } from 'next/server'
import { isDemoMode } from '@/lib/demo/data'
import { getDemoProviders, getLiveProviders } from '@/lib/find-care/providers'
import { getDemoOrgListings, getPublicOrgListings } from '@/lib/orgs/public'
import { FindCareClient } from './find-care-client'

async function isSignedIn(): Promise<boolean> {
  try {
    const { currentUser } = await import('@/lib/auth/roles')
    // currentUser() returns null unless the session completed MFA (AAL2).
    return !!(await currentUser())
  } catch {
    return false
  }
}

export const metadata: Metadata = {
  title: 'Find a health professional — Sanus',
  description:
    'Browse health professionals, and services and events from organizations, all reviewed and approved by Sanus.',
}

export default async function FindCarePage() {
  // Listings change as professionals go live — render per request.
  await connection()

  const isDemo = isDemoMode()
  const [providers, orgListings, signedIn] = isDemo
    ? [getDemoProviders(), getDemoOrgListings(), false]
    : await Promise.all([getLiveProviders(), getPublicOrgListings(), isSignedIn()])

  return <FindCareClient providers={providers} orgListings={orgListings} signedIn={signedIn} isDemo={isDemo} />
}
