import type { Metadata } from 'next'
import { connection } from 'next/server'
import { isDemoMode } from '@/lib/demo/data'
import { getDemoProviders, getLiveProviders } from '@/lib/find-care/providers'
import { getDemoOrgListings, getPublicOrgListings } from '@/lib/orgs/public'
import { FindCareClient } from '@/app/find-care/find-care-client'

export const metadata: Metadata = { title: 'Find professionals — Sanus' }

/**
 * Browse mode: a professional using Sanus as a client. Same search as the
 * public /find-care, inside the app. Your own profile is left out — you
 * can't book your own listings.
 */
export default async function BrowsePage() {
  await connection()
  const isDemo = isDemoMode()
  let providers = isDemo ? getDemoProviders() : await getLiveProviders()
  const orgListings = isDemo ? getDemoOrgListings() : await getPublicOrgListings()

  if (!isDemo) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) providers = providers.filter((p) => p.id !== user.id)
  }

  // Inside the app the viewer is signed in (the proxy enforces MFA here).
  return <FindCareClient providers={providers} orgListings={orgListings} signedIn isDemo={isDemo} embedded />
}
