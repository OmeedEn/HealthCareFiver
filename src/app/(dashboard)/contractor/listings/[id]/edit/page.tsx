import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ListingForm } from '@/components/listings/listing-form'
import { getOwnListing } from '@/lib/listings/data'
import { getDemoListing } from '@/lib/listings/demo'
import { rowToDraft } from '@/lib/listings/offering'
import { getListingsContext } from '../../context'

export const metadata: Metadata = { title: 'Edit listing — Sanus' }

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getListingsContext()
  const listing = ctx.supabase
    ? await getOwnListing(ctx.supabase, ctx.userId, id)
    : getDemoListing(id)
  if (!listing) notFound()

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
        <h1 className="text-2xl font-bold text-[#404145]">Edit listing</h1>
        <p className="text-[#62646a]">{listing.title}</p>
      </div>
      {listing.status === 'rejected' && (
        <div className="rounded-lg bg-[#fdecea] p-3 text-sm text-[#7a2318]">
          <p className="font-semibold">Changes requested</p>
          <p className="mt-0.5">
            {listing.review_notes ??
              'Our team asked for changes. Update the listing and submit it again.'}
          </p>
        </div>
      )}
      <ListingForm
        listingId={listing.id}
        initial={rowToDraft(listing)}
        status={listing.status}
        insured={ctx.state.isInsured}
      />
    </div>
  )
}
