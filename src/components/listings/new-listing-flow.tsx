'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { QuestionFlow, SINGLE_STEP } from '@/components/onboarding/question-flow'
import type { ListingRow, OfferingKind } from '@/lib/listings/offering'
import { useListingQuestions } from './listing-questions'

/**
 * /contractor/listings/new: a new listing (or an unfinished draft, `row`)
 * one question per screen. Saved as a draft as it goes; the last answer
 * opens the listing's review page to submit it.
 */
export function NewListingFlow({
  row = null,
  initialKind,
  insured,
}: {
  row?: ListingRow | null
  initialKind?: OfferingKind
  insured: boolean
}) {
  const router = useRouter()
  const listing = useListingQuestions({ row, initialKind, insured })
  const [initialIndex] = useState(() => (row || initialKind ? listing.firstOpen() : 0))

  return (
    <QuestionFlow
      screens={listing.screens}
      initialIndex={initialIndex}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="pro_listing"
      onExit={() => router.push('/contractor/listings')}
      onFinish={() => {
        toast.success('Saved as a draft.')
        router.push(listing.listingId ? `/contractor/listings/${listing.listingId}/review` : '/contractor/listings')
        router.refresh()
      }}
    />
  )
}
