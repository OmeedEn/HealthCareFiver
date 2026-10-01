import type { Metadata } from 'next'
import { connection } from 'next/server'
import { isDemoMode } from '@/lib/demo/data'
import { getDemoProviders, getLiveProviders } from '@/lib/find-care/providers'
import { FindCareClient } from './find-care-client'

export const metadata: Metadata = {
  title: 'Find a health professional — Sanus',
  description:
    'Browse health professionals who have been reviewed and approved by Sanus.',
}

export default async function FindCarePage() {
  // Listings change as professionals go live — render per request.
  await connection()

  const isDemo = isDemoMode()
  const providers = isDemo ? getDemoProviders() : await getLiveProviders()

  return <FindCareClient providers={providers} isDemo={isDemo} />
}
