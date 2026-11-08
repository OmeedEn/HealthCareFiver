import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Old admin list URLs (pre-consolidation) forward to their new home, keeping
 * the query string so filters and bookmarks survive. Auth is still enforced by
 * the proxy, the admin layout and the destination page.
 */
export async function legacyRedirect(target: string, searchParams: Promise<SearchParams>): Promise<never> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) {
    for (const value of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, value)
  }
  const qs = params.toString()
  redirect(qs ? `${target}?${qs}` : target)
}
