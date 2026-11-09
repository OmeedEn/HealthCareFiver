import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clock, ShieldAlert } from 'lucide-react'
import { DEMO_CONTRACTOR } from '@/lib/demo/data'
import { getOwnListing } from '@/lib/listings/data'
import { getDemoListing } from '@/lib/listings/demo'
import { formatCents, type ListingRow } from '@/lib/listings/offering'
import {
  FEE_BEING_FINALIZED,
  feeBreakdown,
  getPlatformFeePercent,
} from '@/lib/fees'
import { ListingCard, toPublicListing } from '@/components/listings/listing-card'
import { ListingStatusBadge } from '@/components/listings/listing-badges'
import { SubmitForReviewButton } from '@/components/listings/listing-actions'
import {
  PublishGateNotice,
  publishGate,
} from '@/components/listings/publish-gate'
import { getListingsContext } from '../../context'

export const metadata: Metadata = { title: 'Review and publish — Sanus' }

type Owner = {
  name: string
  headline: string | null
  avatarUrl: string | null
}

export default async function ReviewListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getListingsContext()

  let listing: ListingRow | null
  let owner: Owner
  if (ctx.supabase) {
    const [l, { data: cp }, { data: p }] = await Promise.all([
      getOwnListing(ctx.supabase, ctx.userId, id),
      ctx.supabase
        .from('contractor_profiles')
        .select('first_name, last_name, headline')
        .eq('id', ctx.userId)
        .maybeSingle(),
      ctx.supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', ctx.userId)
        .maybeSingle(),
    ])
    listing = l
    owner = {
      name: [cp?.first_name, cp?.last_name].filter(Boolean).join(' ') || 'You',
      headline: (cp?.headline as string | null) ?? null,
      avatarUrl: (p?.avatar_url as string | null) ?? null,
    }
  } else {
    listing = getDemoListing(id)
    owner = {
      name: `${DEMO_CONTRACTOR.first_name} ${DEMO_CONTRACTOR.last_name}`,
      headline: DEMO_CONTRACTOR.headline,
      avatarUrl: null,
    }
  }
  if (!listing) notFound()

  const gate = publishGate(ctx.state)
  const canSubmit =
    gate.kind === 'ok' &&
    (listing.status === 'draft' ||
      listing.status === 'rejected' ||
      listing.status === 'paused')
  const waitsForMalpractice = listing.requires_malpractice && !ctx.state.isInsured

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/contractor/listings"
        className="inline-flex items-center gap-1.5 text-sm text-[#5f5d57] hover:text-[#1a1a17]"
      >
        <ArrowLeft className="size-4" />
        Back to listings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a17]">Review and publish</h1>
          <p className="text-[#5f5d57]">
            This is how clients will see your listing.
          </p>
        </div>
        <ListingStatusBadge status={listing.status} />
      </div>

      {/* Client view */}
      <section aria-label="Client preview" className="rounded-2xl bg-[#f6f4ef] p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          {owner.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase storage host
            <img src={owner.avatarUrl} alt="" className="size-11 rounded-full object-cover" />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-full bg-[#eceefe] text-sm font-bold text-[#2330c8]">
              {owner.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-[#1a1a17]">{owner.name}</p>
            {owner.headline && (
              <p className="truncate text-sm text-[#5f5d57]">{owner.headline}</p>
            )}
          </div>
        </div>
        <ListingCard listing={toPublicListing(listing)} />
      </section>

      <FeeCard listing={listing} />

      {listing.status === 'rejected' && (
        <div className="rounded-lg bg-[#fdecea] p-3 text-sm text-[#7a2318]">
          <p className="font-semibold">Changes requested</p>
          <p className="mt-0.5">
            {listing.review_notes ??
              'Our team asked for changes. Edit the listing, then submit it again.'}
          </p>
        </div>
      )}

      {/* Submit */}
      <section className="space-y-3 rounded-xl border border-[#e3dfd6] bg-white p-5">
        <h2 className="text-base font-semibold text-[#1a1a17]">Publish</h2>
        {listing.status === 'pending_review' ? (
          <p className="flex items-start gap-2 text-sm text-[#5f5d57]">
            <Clock className="mt-0.5 size-4 shrink-0 text-[#8a5a00]" />
            Submitted — our team is reviewing this listing. Editing it will
            withdraw it from review.
          </p>
        ) : listing.status === 'published' ? (
          <p className="flex items-start gap-2 text-sm text-[#5f5d57]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2f3cf5]" />
            This listing is live.
          </p>
        ) : (
          <>
            <p className="text-sm text-[#5f5d57]">
              Our team reviews every listing before it goes live — usually
              within 24–48 hours.
            </p>
            {waitsForMalpractice && gate.kind === 'ok' && (
              <div className="flex items-start gap-2 rounded-lg border border-[#ecd3a3] bg-[#fbf0dc] p-3 text-sm text-[#8a5a00]">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>
                  You can submit this listing now, but it won’t go live until
                  your malpractice certificate has been reviewed — in-person
                  care, home visits, prescribing, injectables, and IVs require
                  it.{' '}
                  <Link
                    href="/contractor/credentials/upload?type=malpractice_insurance"
                    className="font-semibold underline"
                  >
                    Upload malpractice certificate
                  </Link>
                </p>
              </div>
            )}
            <PublishGateNotice gate={gate} />
            {canSubmit && <SubmitForReviewButton listingId={listing.id} />}
          </>
        )}
        <div className="pt-1">
          <Link
            href={`/contractor/listings/${listing.id}/edit`}
            className="text-sm font-medium text-[#2f3cf5] hover:underline"
          >
            Edit listing
          </Link>
        </div>
      </section>
    </div>
  )
}

function FeeCard({ listing }: { listing: ListingRow }) {
  const pct = getPlatformFeePercent()
  const unit =
    listing.kind === 'event'
      ? 'per attendee'
      : listing.kind === 'consulting'
        ? 'per engagement'
        : 'per booking'

  let body: React.ReactNode
  if (pct == null) {
    body = <p className="text-sm text-[#5f5d57]">{FEE_BEING_FINALIZED}</p>
  } else if (listing.kind === 'event' && listing.is_free) {
    body = (
      <p className="text-sm text-[#5f5d57]">
        This is a free listing, so there’s no service fee.
      </p>
    )
  } else {
    const fee = feeBreakdown(listing.price_cents)
    body = fee ? (
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#5f5d57]">Client pays ({unit})</dt>
          <dd className="font-medium text-[#1a1a17]">
            {formatCents(listing.price_cents ?? 0)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#5f5d57]">Sanus service fee ({pct}%)</dt>
          <dd className="font-medium text-[#1a1a17]">−{formatCents(fee.feeCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-[#eeebe4] pt-2">
          <dt className="font-semibold text-[#1a1a17]">You receive</dt>
          <dd className="font-semibold text-[#2330c8]">
            {formatCents(fee.payoutCents)}
          </dd>
        </div>
      </dl>
    ) : (
      <p className="text-sm text-[#5f5d57]">
        Sanus service fee: {pct}% of each quote you send. You receive the rest.
      </p>
    )
  }

  return (
    <section className="rounded-xl border border-[#e3dfd6] bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-[#1a1a17]">Fees</h2>
      {body}
    </section>
  )
}
