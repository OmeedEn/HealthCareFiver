import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ListingForm } from '@/components/listings/listing-form'
import type { OfferingKind } from '@/lib/listings/offering'
import { getListingsContext } from '../context'

export const metadata: Metadata = { title: 'New listing — Sanus' }

const KINDS: readonly OfferingKind[] = ['service', 'consulting', 'event']

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const ctx = await getListingsContext()
  const kind = (await searchParams).kind
  const initialKind = KINDS.find((k) => k === kind)
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/contractor/listings"
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to listings
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">New listing</h1>
        <p className="text-[#62646a]">
          Saved as a draft. You can review and submit it when you’re ready.
        </p>
      </div>
      <ListingForm listingId={null} initial={null} insured={ctx.state.isInsured} initialKind={initialKind} />
    </div>
  )
}
