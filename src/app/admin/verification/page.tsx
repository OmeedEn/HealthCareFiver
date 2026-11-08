import { legacyRedirect } from '@/lib/admin/legacy-redirect'

export const dynamic = 'force-dynamic'

/**
 * Moved to /admin/review (?tab=organizations was the org queue). Applicant
 * detail pages stay at /admin/verification/[contractorId].
 */
export default async function LegacyVerificationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tab, ...rest } = await searchParams
  const target = tab === 'organizations' ? '/admin/review/organizations' : '/admin/review/professionals'
  return legacyRedirect(target, Promise.resolve(rest))
}
