'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initPostHog, trackPageView } from '@/lib/analytics/posthog'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    trackPageView()
  }, [pathname])

  return <>{children}</>
}
