'use client'

import { useState } from 'react'
import { CreditCard, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TextAreaField, TextField } from '@/app/onboarding/professional/ui'
import { isoToLocalInput, localInputToIso } from '@/app/onboarding/organization/listing-draft'
import { customerBookingAction, payForBooking, respondToBooking, sendBookingMessage, type BookingActionResult } from '@/lib/bookings/actions'
import { money, needsPayment, type BookingRow } from '@/lib/bookings/types'

const GREEN = 'h-11 bg-[#1dbf73] px-5 text-sm font-semibold text-white hover:bg-[#19a463]'

function useRun() {
  const [busy, setBusy] = useState<string | null>(null)
  async function run(key: string, fn: () => Promise<BookingActionResult>, success: string) {
    setBusy(key)
    const res = await fn()
    setBusy(null)
    if (res.ok) toast.success(success)
    else toast.error(res.error)
    return res.ok
  }
  return { busy, run }
}

/** What the organization can do with a booking. */
export function OrgBookingActions({ booking: b }: { booking: BookingRow }) {
  const { busy, run } = useRun()
  const [mode, setMode] = useState<null | 'accept' | 'quote' | 'decline' | 'cancel'>(null)
  const [price, setPrice] = useState('')
  const [time, setTime] = useState(isoToLocalInput(b.requested_start))
  const [note, setNote] = useState('')
  const needsQuote = b.price_cents == null

  if (b.status === 'requested' || b.status === 'quoted' || b.status === 'accepted' || b.status === 'paid') {
    const submit = (action: 'accept' | 'quote' | 'decline' | 'cancel', success: string) =>
      run(
        action,
        () =>
          respondToBooking({
            bookingId: b.id,
            action,
            priceDollars: action === 'quote' ? price : undefined,
            scheduledStart: b.kind === 'service' && (action === 'accept' || action === 'quote') && time ? localInputToIso(time) : null,
            note,
          }),
        success
      ).then((ok) => ok && setMode(null))

    return (
      <div className="space-y-4">
        {mode === null && (
          <div className="flex flex-wrap gap-3">
            {b.status === 'requested' && !needsQuote && (
              <Button type="button" className={GREEN} onClick={() => setMode('accept')}>Accept</Button>
            )}
            {b.status === 'requested' && (
              <Button type="button" variant={needsQuote ? 'default' : 'outline'} className={needsQuote ? GREEN : 'h-11'} onClick={() => setMode('quote')}>
                Send a quote
              </Button>
            )}
            {(b.status === 'requested' || b.status === 'quoted') && (
              <Button type="button" variant="outline" className="h-11" onClick={() => setMode('decline')}>Decline</Button>
            )}
            {(b.status === 'accepted' || b.status === 'paid') && (
              <Button type="button" variant="outline" className="h-11" onClick={() => setMode('cancel')}>Cancel booking</Button>
            )}
            {b.status === 'quoted' && <p className="self-center text-sm text-[#62646a]">Waiting for the customer to accept your quote.</p>}
          </div>
        )}

        {mode && (
          <form
            className="space-y-4 rounded-xl border border-[#e4e5e7] bg-[#fafafa] p-5"
            onSubmit={(e) => {
              e.preventDefault()
              const copy = {
                accept: 'Booking accepted. We let the customer know.',
                quote: 'Quote sent.',
                decline: 'Request declined.',
                cancel: 'Booking cancelled.',
              }[mode]
              void submit(mode, copy)
            }}
          >
            {mode === 'quote' && (
              <div className="max-w-[220px]">
                <TextField id="quote-price" label="Total price ($)" value={price} onChange={setPrice} inputMode="decimal" placeholder="e.g. 1200" />
              </div>
            )}
            {(mode === 'accept' || mode === 'quote') && b.kind === 'service' && (
              <div className="max-w-[280px]">
                <TextField
                  id="booking-time"
                  label="Confirmed date and time"
                  type="datetime-local"
                  value={time}
                  onChange={setTime}
                  hint={
                    (mode === 'quote' ? Number(price) > 0 : (b.price_cents ?? 0) > 0)
                      ? 'Required: the customer pays once it’s set.'
                      : 'Leave blank to arrange in messages.'
                  }
                />
              </div>
            )}
            {mode === 'cancel' && b.payment_status === 'paid' && (
              <p className="text-sm text-[#62646a]">
                The customer paid {money(b.amount_paid_cents)}. Cancelling refunds them in full, and there’s no payout for this booking.
              </p>
            )}
            <TextAreaField
              id="org-note"
              label={mode === 'decline' || mode === 'cancel' ? 'Reason (optional)' : 'Note to the customer (optional)'}
              value={note}
              onChange={setNote}
              maxLength={2000}
              rows={3}
            />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={!!busy} className={mode === 'decline' || mode === 'cancel' ? 'h-11 bg-[#404145] px-5 text-white hover:bg-[#2b2c2f]' : GREEN}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                {{ accept: 'Accept booking', quote: 'Send quote', decline: 'Decline request', cancel: 'Cancel booking' }[mode]}
              </Button>
              <Button type="button" variant="ghost" className="h-11" onClick={() => setMode(null)}>Back</Button>
            </div>
          </form>
        )}
      </div>
    )
  }
  return null
}

/** What the customer can do with a booking. */
export function CustomerBookingActions({
  booking: b,
  cancelNote,
  paymentsOpen,
}: {
  booking: BookingRow
  /** What cancelling means for their money, worked out on the server. */
  cancelNote: string | null
  paymentsOpen: boolean
}) {
  const { busy, run } = useRun()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [paying, setPaying] = useState(false)
  if (!['requested', 'quoted', 'accepted', 'paid'].includes(b.status)) return null

  async function pay() {
    setPaying(true)
    const res = await payForBooking(b.id)
    if (res.ok) {
      window.location.assign(res.url)
      return
    }
    setPaying(false)
    toast.error(res.error)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {b.status === 'quoted' && (
          <Button
            type="button"
            className={GREEN}
            disabled={!!busy}
            onClick={() => run('accept', () => customerBookingAction(b.id, 'accept_quote'), 'Quote accepted.')}
          >
            {busy === 'accept' && <Loader2 className="mr-2 size-4 animate-spin" />}
            Accept quote
          </Button>
        )}
        {needsPayment(b) && paymentsOpen && (
          <Button type="button" className={GREEN} disabled={paying || !!busy} onClick={pay}>
            {paying ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CreditCard className="mr-2 size-4" />}
            Pay {money(b.price_cents)}
          </Button>
        )}
        {confirmCancel ? (
          <>
            <Button
              type="button"
              className="h-11 bg-[#404145] px-5 text-white hover:bg-[#2b2c2f]"
              disabled={!!busy}
              onClick={() => run('cancel', () => customerBookingAction(b.id, 'cancel'), 'Cancelled.')}
            >
              {busy === 'cancel' && <Loader2 className="mr-2 size-4 animate-spin" />}
              Yes, cancel
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setConfirmCancel(false)}>Keep it</Button>
          </>
        ) : (
          <Button type="button" variant="outline" className="h-11" onClick={() => setConfirmCancel(true)}>
            {b.status === 'accepted' || b.status === 'paid' ? 'Cancel booking' : 'Cancel request'}
          </Button>
        )}
      </div>
      {confirmCancel && cancelNote && <p className="text-sm font-medium text-[#404145]">{cancelNote}</p>}
    </div>
  )
}

/** Message box under the thread. */
export function BookingMessageForm({ bookingId }: { bookingId: string }) {
  const { busy, run } = useRun()
  const [body, setBody] = useState('')
  return (
    <form
      className="flex items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!body.trim()) return
        if (await run('send', () => sendBookingMessage(bookingId, body), 'Message sent.')) setBody('')
      }}
    >
      <div className="flex-1">
        <TextAreaField id="booking-message" label="Message" value={body} onChange={setBody} maxLength={4000} rows={2} placeholder="Write a message…" />
      </div>
      <Button type="submit" disabled={!!busy || !body.trim()} className="mb-6 h-11 bg-[#1dbf73] px-4 text-white hover:bg-[#19a463]" aria-label="Send message">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </Button>
    </form>
  )
}
