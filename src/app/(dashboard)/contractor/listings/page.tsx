import type { Metadata } from 'next'
import Link from 'next/link'
import { Eye, Pencil, PlusCircle, Send } from 'lucide-react'
import { listOwnListings } from '@/lib/listings/data'
import { DEMO_LISTINGS } from '@/lib/listings/demo'
import { KIND_LABELS, priceLine } from '@/lib/listings/offering'
import {
  ListingStatusBadge,
  NeedsMalpracticeTag,
} from '@/components/listings/listing-badges'
import { DeleteListingButton } from '@/components/listings/listing-actions'
import {
  PublishGateNotice,
  publishGate,
} from '@/components/listings/publish-gate'
import { getListingsContext } from './context'

export const metadata: Metadata = { title: 'Listings — Sanus' }

export default async function ListingsPage() {
  const ctx = await getListingsContext()
  const listings = ctx.supabase
    ? await listOwnListings(ctx.supabase, ctx.userId)
    : DEMO_LISTINGS
  const gate = publishGate(ctx.state)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">Listings</h1>
          <p className="text-[#62646a]">
            Services, consulting, and events clients can book. Every listing is
            reviewed before it goes live.
          </p>
        </div>
        <Link
          href="/contractor/listings/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1dbf73] px-4 text-sm font-semibold text-white hover:bg-[#19a463]"
        >
          <PlusCircle className="size-4" />
          New listing
        </Link>
      </div>

      <PublishGateNotice gate={gate} />

      {listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e4e5e7] bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-[#404145]">
            No listings yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#62646a]">
            Create your first listing — it’s saved as a draft until you submit
            it for review.
          </p>
          <Link
            href="/contractor/listings/new"
            className="mt-4 inline-flex h-9 items-center rounded-md bg-[#1dbf73] px-4 text-sm font-semibold text-white hover:bg-[#19a463]"
          >
            Create a listing
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border border-[#e4e5e7] bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ListingStatusBadge status={l.status} />
                    {l.requires_malpractice && !ctx.state.isInsured && (
                      <NeedsMalpracticeTag />
                    )}
                    <span className="text-xs text-[#95979d]">
                      {KIND_LABELS[l.kind]}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate font-semibold text-[#404145]">
                    {l.title}
                  </p>
                  <p className="text-sm text-[#62646a]">{priceLine(l)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <Link
                    href={`/contractor/listings/${l.id}/edit`}
                    className="inline-flex items-center gap-1 font-medium text-[#404145] hover:underline"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Link>
                  <Link
                    href={`/contractor/listings/${l.id}/review`}
                    className="inline-flex items-center gap-1 font-semibold text-[#1dbf73] hover:underline"
                  >
                    {l.status === 'draft' ||
                    l.status === 'rejected' ||
                    l.status === 'paused' ? (
                      <>
                        <Send className="size-3.5" />
                        Review and publish
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" />
                        Preview
                      </>
                    )}
                  </Link>
                  <DeleteListingButton listingId={l.id} />
                </div>
              </div>
              {l.status === 'rejected' && (
                <div className="mt-3 rounded-lg bg-[#fdecea] p-3 text-sm text-[#7a2318]">
                  <p className="font-semibold">Changes requested</p>
                  <p className="mt-0.5">
                    {l.review_notes ??
                      'Our team asked for changes. Edit the listing and submit it again.'}
                  </p>
                </div>
              )}
              {l.status === 'paused' && (
                <p className="mt-3 rounded-lg bg-[#eef2ff] p-3 text-sm text-[#2d3794]">
                  {l.review_notes ??
                    (l.requires_malpractice && !ctx.state.isInsured
                      ? 'Paused and hidden from clients until your malpractice certificate is uploaded and reviewed.'
                      : 'Paused and hidden from clients.')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
