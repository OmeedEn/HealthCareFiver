'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { QuestionFlow, type Screen } from '@/app/onboarding/organization/flow'
import { CheckRow, TextAreaField, TextField, Toggle } from '@/app/onboarding/professional/ui'
import { localInputToIso } from '@/app/onboarding/organization/listing-draft'
import { BOOKING_TERMS_PATH, BOOKING_TERMS_VERSION } from '@/lib/legal'
import { requestBooking } from '@/lib/bookings/actions'
import { money } from '@/lib/bookings/types'
import type { PublicOrgListing } from '@/lib/orgs/public'

const OK = { ok: true } as const
const need = (cond: boolean, key: string, msg: string): Record<string, string> => (cond ? {} : { [key]: msg })

function needsQuote(l: PublicOrgListing) {
  return l.kind === 'service' && (l.contactForPricing || l.reachVia === 'inquiry' || l.priceCents == null)
}

/** "Request booking" / "Register" / "Request a quote" for a signed-in visitor. */
export function RequestBookingButton({ listing }: { listing: PublicOrgListing }) {
  const [open, setOpen] = useState(false)
  const label = needsQuote(listing) ? 'Request a quote' : listing.kind === 'event' ? 'Register' : 'Request booking'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-semibold text-white transition hover:bg-[#19a463]"
      >
        {label}
      </button>
      {open && <RequestDialog listing={listing} onClose={() => setOpen(false)} />}
    </>
  )
}

function RequestDialog({ listing, onClose }: { listing: PublicOrgListing; onClose: () => void }) {
  const router = useRouter()
  const [quantity, setQuantity] = useState(1)
  const [when, setWhen] = useState('')
  const [flexible, setFlexible] = useState(false)
  const [note, setNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const quote = needsQuote(listing)
  const maxSpots = Math.max(1, Math.min(listing.capacity ?? 10, 10))
  const section = listing.title

  const total =
    listing.kind === 'event'
      ? listing.isFree
        ? 'Free'
        : money(listing.priceCents == null ? null : listing.priceCents * quantity)
      : quote
        ? 'You’ll get a quote'
        : money(listing.priceCents)

  const screens: Screen[] = [
    ...(listing.kind === 'event'
      ? [
          {
            id: 'spots',
            step: 1,
            section,
            title: 'How many spots do you need?',
            sub: listing.capacity ? `Up to ${listing.capacity} people can attend.` : undefined,
            render: () => (
              <div className="flex items-center gap-4">
                <StepButton label="One fewer" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Minus className="size-5" />
                </StepButton>
                {/* A real input, so the flow focuses it and Enter continues. */}
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxSpots}
                  aria-label="Number of spots"
                  value={quantity}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) setQuantity(Math.max(1, Math.min(maxSpots, Math.round(n))))
                  }}
                  className="h-14 w-20 rounded-xl border border-[#e4e5e7] bg-white text-center text-3xl font-bold text-[#404145] outline-none [appearance:textfield] focus:border-[#1dbf73] focus:ring-3 focus:ring-[#1dbf73]/20 [&::-webkit-inner-spin-button]:appearance-none"
                />
                <StepButton label="One more" disabled={quantity >= maxSpots} onClick={() => setQuantity((q) => Math.min(maxSpots, q + 1))}>
                  <Plus className="size-5" />
                </StepButton>
              </div>
            ),
          } satisfies Screen,
        ]
      : [
          {
            id: 'when',
            step: 1,
            section,
            title: 'When works for you?',
            sub: 'The organization confirms the exact time when they accept.',
            validate: (): Record<string, string> => {
              if (flexible) return {}
              if (!when) return { when: 'Pick a date and time, or choose “I’m flexible”' }
              return Date.parse(when) < Date.now() ? { when: 'Pick a time in the future' } : {}
            },
            render: ({ errors }) => (
              <>
                {!flexible && (
                  <div className="max-w-[280px]">
                    <TextField id="booking-when" label="Preferred date and time" type="datetime-local" value={when} onChange={setWhen} error={errors.when} />
                  </div>
                )}
                <Toggle id="booking-flexible" checked={flexible} onChange={setFlexible} label="I’m flexible" />
              </>
            ),
          } satisfies Screen,
        ]),
    {
      id: 'note',
      step: 1,
      section,
      title: quote ? 'What do you need?' : 'Anything they should know?',
      sub: 'Don’t include phone numbers, emails, or links. You can message them here on Sanus.',
      optional: !quote,
      validate: () => need(!quote || !!note.trim(), 'note', 'Tell them what you need so they can quote'),
      render: ({ errors }) => (
        <TextAreaField id="booking-note" label="Note" value={note} onChange={setNote} maxLength={2000} counter rows={4} error={errors.note} />
      ),
    },
    {
      id: 'review',
      step: 1,
      section,
      title: quote ? 'Send your quote request?' : listing.kind === 'event' ? 'Send your registration?' : 'Send your booking request?',
      sub: 'The organization reviews it first. You won’t pay anything until it’s accepted.',
      validate: () => need(agreed, 'terms', 'Please accept the booking terms'),
      continueLabel: quote ? 'Request quote' : 'Send request',
      save: async () => {
        const res = await requestBooking({
          listingId: listing.id,
          quantity,
          requestedStart: listing.kind === 'service' && !flexible && when ? localInputToIso(when) : null,
          note,
          termsVersion: BOOKING_TERMS_VERSION,
        })
        if (!res.ok) return res
        toast.success('Request sent. We’ll let you know when they respond.')
        router.push(`/bookings/${res.id}`)
        return OK
      },
      render: ({ errors }) => (
        <>
          <dl className="space-y-2 rounded-xl border border-[#e4e5e7] bg-white p-5 text-sm">
            <Row label={listing.kind === 'event' ? 'Event' : 'Service'} value={listing.title} />
            {listing.kind === 'event' && <Row label="Spots" value={String(quantity)} />}
            {listing.kind === 'service' && (
              <Row label="Preferred time" value={flexible || !when ? 'Flexible' : new Date(when).toLocaleString()} />
            )}
            <Row label="Price" value={total} />
          </dl>
          <CheckRow
            id="booking-terms"
            checked={agreed}
            onChange={setAgreed}
            label="I agree to the Booking Terms and will keep booking, payment, and messages on Sanus."
            error={errors.terms}
          />
          <p className="text-xs text-[#62646a]">
            Read the{' '}
            <Link href={BOOKING_TERMS_PATH} target="_blank" className="font-semibold text-[#0f8f56] underline">
              Booking Terms
            </Link>
            .
          </p>
        </>
      ),
    },
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-10">
        <DialogTitle className="sr-only">{section}</DialogTitle>
        <QuestionFlow screens={screens} initialIndex={0} stepWeights={{ 1: 1 }} onFinish={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#62646a]">{label}</dt>
      <dd className="text-right font-semibold text-[#404145]">{value}</dd>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // Keep focus in the number field so Enter still continues.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full border border-[#e4e5e7] bg-white text-[#404145] transition hover:border-[#1dbf73] hover:text-[#1dbf73] disabled:opacity-40"
    >
      {children}
    </button>
  )
}
