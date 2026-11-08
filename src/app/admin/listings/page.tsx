import { legacyRedirect } from '@/lib/admin/legacy-redirect'

export const dynamic = 'force-dynamic'

/** Moved to /admin/review/listings; keeps old links and bookmarks working. */
export default async function LegacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return legacyRedirect('/admin/review/listings', searchParams)
}
