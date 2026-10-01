'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Dashboard crash boundary. Files an auto-captured bug report so crashes show
 * up in /admin/bugs even while Sentry isn't configured. Only the message and
 * digest are sent — never component state, which may contain PHI.
 */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    fetch('/api/bug-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'auto',
        title: `Crash: ${(error.message || 'Unknown error').slice(0, 180)}`,
        pageUrl: window.location.pathname,
        errorDigest: error.digest,
      }),
    }).catch(() => {})
  }, [error])

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h2 className="text-lg font-semibold text-[#404145]">Something went wrong</h2>
      <p className="mt-2 text-sm text-[#62646a]">
        We&apos;ve been notified automatically. Try again, or use &ldquo;Report a bug&rdquo; to tell us more.
      </p>
      <Button className="mt-6" onClick={() => unstable_retry()}>
        Try again
      </Button>
    </div>
  )
}
