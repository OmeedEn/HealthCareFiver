'use client'

import { TopNav } from '@/components/layout/top-nav'
import { PUBLIC_NAV } from '@/components/layout/nav-config'

/** @deprecated use PUBLIC_NAV from '@/components/layout/nav-config'. */
export const MARKETING_NAV = PUBLIC_NAV

/**
 * Public header for the homepage and every marketing page. It's the same
 * top nav the signed-in app uses, so signed-in visitors see their messages,
 * notifications and avatar menu here (and no "Join Sanus" button).
 */
export function SiteHeader() {
  return <TopNav />
}
