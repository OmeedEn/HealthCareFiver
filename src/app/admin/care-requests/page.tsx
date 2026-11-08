import { legacyRedirect } from '@/lib/admin/legacy-redirect'

export const dynamic = 'force-dynamic'

/** Moved to /admin/inbox/care-requests; keeps old links and bookmarks working. */
export default async function LegacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return legacyRedirect('/admin/inbox/care-requests', searchParams)
}
