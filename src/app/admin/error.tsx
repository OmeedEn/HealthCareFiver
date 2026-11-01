'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[admin] page error', error)
  }, [error])

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="space-y-3 pt-6 text-sm text-[#404145]">
        <p className="text-base font-semibold">Something went wrong on this page.</p>
        <p className="text-[#62646a]">
          Try again, or go back to the Verification queue. If it keeps happening, check the server logs.
          {error.digest && <span className="block text-xs text-[#95979d]">Reference: {error.digest}</span>}
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => unstable_retry()} className="bg-[#1dbf73] text-white hover:bg-[#19a463]">
            Try again
          </Button>
          <Link
            href="/admin/verification"
            className="inline-flex h-7 items-center rounded-md border border-[#e4e5e7] px-2.5 text-sm hover:border-[#1dbf73]"
          >
            Verification
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
