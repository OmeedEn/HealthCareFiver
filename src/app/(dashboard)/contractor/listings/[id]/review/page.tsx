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
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to listings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">Review and publish</h1>
          <p className="text-[#62646a]">
            This is how clients will see your listing.
          </p>
        </div>
        <ListingStatusBadge status={listing.status} />
      </div>

      {/* Client view */}
      <section aria-label="Client preview" className="rounded-2xl bg-[#f9fafb] p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          {owner.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase storage host
            <img src={owner.avatarUrl} alt="" className="size-11 rounded-full object-cover" />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-full bg-[#e8faf1] text-sm font-bold text-[#0f8f56]">
              {owner.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-[#111827]">{owner.name}</p>
            {owner.headline && (
              <p className="truncate text-sm text-[#6b7280]">{owner.headline}</p>
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
      <section className="space-y-3 rounded-xl border border-[#e4e5e7] bg-white p-5">
        <h2 className="text-base font-semibold text-[#404145]">Publish</h2>
        {listing.status === 'pending_review' ? (
          <p className="flex items-start gap-2 text-sm text-[#62646a]">
            <Clock className="mt-0.5 size-4 shrink-0 text-[#8a6508]" />
            Submitted — our team is reviewing this listing. Editing it will
            withdraw it from review.
          </p>
        ) : listing.status === 'published' ? (
          <p className="flex items-start gap-2 text-sm text-[#62646a]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#1dbf73]" />
            This listing is live.
          </p>
        ) : (
          <>
            <p className="text-sm text-[#62646a]">
              Our team reviews every listing before it goes live — usually
              within 24–48 hours.
            </p>
            {waitsForMalpractice && gate.kind === 'ok' && (
              <div className="flex items-start gap-2 rounded-lg border border-[#f5deb3] bg-[#fffaf0] p-3 text-sm text-[#6b5208]">
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
            className="text-sm font-medium text-[#1dbf73] hover:underline"
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
    body = <p className="text-sm text-[#62646a]">{FEE_BEING_FINALIZED}</p>
  } else if (listing.kind === 'event' && listing.is_free) {
    body = (
      <p className="text-sm text-[#62646a]">
        This is a free listing, so there’s no service fee.
      </p>
    )
  } else {
    const fee = feeBreakdown(listing.price_cents)
    body = fee ? (
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#62646a]">Client pays ({unit})</dt>
          <dd className="font-medium text-[#404145]">
            {formatCents(listing.price_cents ?? 0)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#62646a]">Sanus service fee ({pct}%)</dt>
          <dd className="font-medium text-[#404145]">−{formatCents(fee.feeCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-[#f1f3f5] pt-2">
          <dt className="font-semibold text-[#404145]">You receive</dt>
          <dd className="font-semibold text-[#0f8f56]">
            {formatCents(fee.payoutCents)}
          </dd>
        </div>
      </dl>
    ) : (
      <p className="text-sm text-[#62646a]">
        Sanus service fee: {pct}% of each quote you send. You receive the rest.
      </p>
    )
  }

  return (
    <section className="rounded-xl border border-[#e4e5e7] bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-[#404145]">Fees</h2>
      {body}
    </section>
  )
}
