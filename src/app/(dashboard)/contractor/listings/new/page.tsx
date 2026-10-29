import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NewListingFlow } from '@/components/listings/new-listing-flow'
import { getOwnListing } from '@/lib/listings/data'
import type { ListingRow, OfferingKind } from '@/lib/listings/offering'
import { getListingsContext } from '../context'

export const metadata: Metadata = { title: 'New listing — Sanus' }

const KINDS: readonly OfferingKind[] = ['service', 'consulting', 'event']

/**
 * A new listing, one question per screen (the full form at
 * /contractor/listings/[id]/edit is for changing a saved listing).
 * `?draft=<id>` continues an unfinished draft at its first open question;
 * `?kind=` preselects the kind (dashboard first-run cards).
 */
export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const ctx = await getListingsContext()
  const { kind, draft } = await searchParams
  const initialKind = KINDS.find((k) => k === kind)
  let row: ListingRow | null = null
  if (typeof draft === 'string' && ctx.supabase) {
    const found = await getOwnListing(ctx.supabase, ctx.userId, draft)
    if (found?.status === 'draft') row = found
  }
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-2 sm:py-6">
      <Link
        href="/contractor/listings"
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to listings
      </Link>
      <NewListingFlow key={row?.id ?? 'new'} row={row} initialKind={initialKind} insured={ctx.state.isInsured} />
      <p className="text-center text-xs text-[#95979d]">
        Your answers save as a draft as you go. Nothing goes live until you submit it and we review it.
      </p>
    </div>
  )
}
