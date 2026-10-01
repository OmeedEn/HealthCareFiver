'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  deleteListing,
  submitListingForReview,
} from '@/app/(dashboard)/contractor/listings/actions'
import { PRIMARY_BTN } from './form-fields'

export function SubmitForReviewButton({ listingId }: { listingId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [blocked, setBlocked] = useState<{
    error: string
    href?: string
    hrefLabel?: string
  } | null>(null)

  function submit() {
    startTransition(async () => {
      const res = await submitListingForReview(listingId)
      if (!res.ok) {
        setBlocked(res)
        toast.error(res.error)
        return
      }
      toast.success('Submitted for review. We’ll let you know once it’s live.')
      router.push('/contractor/listings')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={submit}
        disabled={pending}
        className={`w-full sm:w-auto ${PRIMARY_BTN}`}
      >
        {pending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Send className="mr-2 size-4" />
        )}
        Submit for review
      </Button>
      {blocked && (
        <p className="text-sm text-[#c0392b]" role="alert">
          {blocked.error}
          {blocked.href && (
            <>
              {' '}
              <Link href={blocked.href} className="font-semibold underline">
                {blocked.hrefLabel ?? 'Fix this'}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}

export function DeleteListingButton({ listingId }: { listingId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove() {
    if (!window.confirm('Delete this listing? This can’t be undone.')) return
    startTransition(async () => {
      const res = await deleteListing(listingId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Listing deleted.')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="inline-flex items-center gap-1 text-sm font-medium text-[#c0392b] hover:underline disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      Delete
    </button>
  )
}
