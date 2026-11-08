'use client'

import { useActionState, useState } from 'react'
import { CalendarCheck, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { requestProBooking, type StartConversationState } from './actions'

export const PRIMARY_CTA =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#2f3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#2330c8] disabled:opacity-60'

const FIELD =
  'mt-1.5 w-full rounded-lg border border-[#e3dfd6] bg-white px-3 py-2.5 text-sm text-[#1a1a17] outline-none focus:border-[#2f3cf5] focus:ring-3 focus:ring-[#2f3cf5]/20'

/**
 * Client "Request booking": a short form whose answers are sent to the
 * professional as a booking request message, then opens the conversation.
 */
export function BookingRequestButton({
  proId,
  firstName,
  services,
  className = PRIMARY_CTA,
}: {
  proId: string
  firstName: string
  /** Service names to pick from (listings and rate labels, no prices). */
  services: string[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<StartConversationState, FormData>(
    requestProBooking.bind(null, proId),
    {}
  )
  const who = firstName || 'this professional'

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <CalendarCheck className="size-4" aria-hidden="true" />
        Request booking
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-lg">
          <DialogTitle className="text-lg font-semibold text-[#1a1a17]">
            Request a booking with {who}
          </DialogTitle>
          <DialogDescription className="text-[#5f5d57]">
            {firstName || 'They'} will reply in Messages to confirm a time. You
            won&apos;t be charged anything yet.
          </DialogDescription>
          <form action={action} className="space-y-4">
            <label className="block text-sm font-medium text-[#3a3934]">
              What do you need?
              {services.length > 0 ? (
                <select name="service" className={FIELD} defaultValue={services[0]}>
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="Something else">Something else</option>
                </select>
              ) : (
                <input
                  name="service"
                  className={FIELD}
                  maxLength={200}
                  placeholder="e.g., In-home wound care visit"
                />
              )}
            </label>
            <label className="block text-sm font-medium text-[#3a3934]">
              How would you like to meet?
              <select name="format" className={FIELD} defaultValue="">
                <option value="">No preference</option>
                <option value="virtual">Video visit</option>
                <option value="in_person">In person</option>
                <option value="home_visit">At my home</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-[#3a3934]">
              Preferred day and time
              <input
                name="when"
                className={FIELD}
                maxLength={200}
                placeholder="e.g., Weekday mornings, starting next week"
              />
            </label>
            <label className="block text-sm font-medium text-[#3a3934]">
              Anything else they should know?
              <textarea
                name="note"
                rows={4}
                maxLength={2000}
                className={FIELD}
                placeholder="A little about what you're looking for. Please don't share medical records here."
              />
            </label>
            {state.error && (
              <p role="alert" className="text-sm text-[#b42318]">
                {state.error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#e3dfd6] px-5 text-sm font-semibold text-[#3a3934] hover:bg-[#f6f4ef]"
              >
                Cancel
              </button>
              <button type="submit" className={PRIMARY_CTA} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Send request
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
