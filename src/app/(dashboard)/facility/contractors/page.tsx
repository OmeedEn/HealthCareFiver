import type { Metadata } from 'next'
import { connection } from 'next/server'
import { isDemoMode } from '@/lib/demo/data'
import { getDemoProviders, getLiveProviders } from '@/lib/find-care/providers'
import { ContractorDirectory } from './contractor-directory'

export const metadata: Metadata = { title: 'Find professionals — Ocora' }

/**
 * Organization directory. Lists exactly the professionals public discovery
 * lists (getLiveProviders: approved + agreement accepted + no hold + active
 * account, seeded sample accounts hidden), so every card's link resolves on
 * /facility/contractors/[id], which applies the same rule.
 *
 * Previously this page queried contractor_profiles from the browser with a
 * looser filter (no active-account or sample-account check) and its detail
 * page failed on a profiles.email embed, so cards ended at "not found".
 */
export default async function FindProfessionalsPage() {
  // Visibility follows live review state — render per request.
  await connection()
  const isDemo = isDemoMode()
  const providers = isDemo ? getDemoProviders() : await getLiveProviders()
  return <ContractorDirectory providers={providers} isDemo={isDemo} />
}
