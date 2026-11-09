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
      <CardContent className="space-y-3 pt-6 text-sm text-[#1a1a17]">
        <p className="text-base font-semibold">Something went wrong on this page.</p>
        <p className="text-[#5f5d57]">
          Try again, or go back to the admin overview. If it keeps happening, check the server logs.
          {error.digest && <span className="block text-xs text-[#706d65]">Reference: {error.digest}</span>}
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => unstable_retry()} className="bg-[#2f3cf5] text-white hover:bg-[#2330c8]">
            Try again
          </Button>
          <Link
            href="/admin"
            className="inline-flex h-7 items-center rounded-md border border-[#e3dfd6] px-2.5 text-sm hover:border-[#2f3cf5]"
          >
            Overview
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
