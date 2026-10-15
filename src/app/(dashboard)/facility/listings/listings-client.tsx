'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Megaphone, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { ActionResult } from '@/app/onboarding/organization/actions'
import { QuestionFlow, type Screen } from '@/components/onboarding/question-flow'
import { eventScreens, serviceScreens } from '@/app/onboarding/organization/listing-questions'
import {
  localInputToIso,
  rowToEvent,
  rowToService,
  type ListingRow,
} from '@/app/onboarding/organization/listing-draft'
import { EMPTY_EVENT } from '@/app/onboarding/organization/sections/event-form'
import { EMPTY_SERVICE } from '@/app/onboarding/organization/sections/service-form'
import type { EventDraft, ServiceDraft } from '@/app/onboarding/organization/shared'
import { deleteOrgListing, saveListingDraft, submitOrgListing, withdrawOrgListing } from './actions'

/** "Add a service" / "Add an event": big buttons that open the question flow. */
export function AddListing() {
  const [open, setOpen] = useState<'service' | 'event' | null>(null)
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <AddTile icon={Megaphone} title="Add a service" sub="Something individuals or businesses can book or ask about." onClick={() => setOpen('service')} />
        <AddTile icon={CalendarDays} title="Add an event" sub="A webinar, workshop, CEU course, health fair, and more." onClick={() => setOpen('event')} />
      </div>
      {open && <ListingFlowDialog kind={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function AddTile({
  icon: Icon,
  title,
  sub,
  onClick,
}: {
  icon: LucideIcon
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-[#e4e5e7] bg-white p-5 text-left transition hover:border-[#1dbf73] hover:bg-[#f0faf5] focus-visible:ring-3 focus-visible:ring-[#1dbf73]/30 focus-visible:outline-none"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73] transition group-hover:bg-[#1dbf73] group-hover:text-white">
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-[#404145]">{title}</span>
        <span className="mt-0.5 block text-sm text-[#62646a]">{sub}</span>
      </span>
      <Plus className="size-5 shrink-0 text-[#95979d] transition group-hover:text-[#1dbf73]" />
    </button>
  )
}

/** "Continue" on a draft: reopens the question flow with its saved answers. */
export function ContinueListingButton({ row }: { row: ListingRow }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 size-3.5" />
        Continue
      </Button>
      {open && <ListingFlowDialog kind={row.kind} row={row} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * One question per screen for a service or event. Each answer is saved as it
 * is given: the first save with a title creates the draft, later ones update
 * it, so closing halfway leaves a draft to continue later.
 */
function ListingFlowDialog({
  kind,
  row,
  onClose,
}: {
  kind: 'service' | 'event'
  row?: ListingRow
  onClose: () => void
}) {
  const router = useRouter()
  const [service, setService] = useState<ServiceDraft>(() => (row && kind === 'service' ? rowToService(row) : EMPTY_SERVICE))
  const [event, setEvent] = useState<EventDraft>(() => (row && kind === 'event' ? rowToEvent(row) : EMPTY_EVENT))
  const [listingId, setListingId] = useState<string | null>(row?.id ?? null)
  // Answered before the draft existed (an event's type comes before its title).
  const [pending, setPending] = useState<string[]>([])
  const [changed, setChanged] = useState(false)

  const value = kind === 'service' ? service : event
  const save = (keys: string[]) => async (): Promise<ActionResult> => {
    const sendKeys = listingId ? keys : Array.from(new Set([...pending, ...keys]))
    const input = { ...value, ...('starts_at' in value ? { starts_at: localInputToIso(value.starts_at) } : {}) }
    const res = await saveListingDraft(kind, listingId, input, sendKeys)
    if (!res.ok) return res
    if (res.id) {
      setListingId(res.id)
      setPending([])
      setChanged(true)
    } else {
      setPending(sendKeys)
    }
    return { ok: true }
  }
  const setS = <K extends keyof ServiceDraft>(k: K, v: ServiceDraft[K]) => setService((d) => ({ ...d, [k]: v }))
  const setE = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setEvent((d) => ({ ...d, [k]: v }))
  const noun = kind === 'service' ? 'service' : 'event'
  const section = `${row ? 'Edit' : 'New'} ${noun}`

  const built =
    kind === 'service'
      ? serviceScreens({ value: service, set: setS, section, saveFields: save, finish: () => save(['reach_via'])(), finishLabel: 'Save draft' })
      : eventScreens({ value: event, set: setE, section, saveFields: save, finish: () => save(['audiences', 'offers_ceu'])(), finishLabel: 'Save draft' })
  const screens: Screen[] = built.map((sc) => ({ ...sc, step: 1 }))

  // Continuing a draft: start at its first unanswered question.
  const [initialIndex] = useState(() => {
    if (!row) return 0
    const i = screens.findIndex((sc) => Object.keys(sc.validate?.() ?? {}).length > 0)
    return i === -1 ? screens.length - 1 : i
  })

  function close(saved = changed) {
    if (saved) router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-10">
        <DialogTitle className="sr-only">{section}</DialogTitle>
        <QuestionFlow
          screens={screens}
          initialIndex={initialIndex}
          stepWeights={{ 1: 1 }}
          onFinish={() => {
            toast.success('Saved as a draft. Submit it for review when you’re ready.')
            close(true)
          }}
        />
        <p className="text-center text-xs text-[#95979d]">
          Your answers save as you go. Close anytime and pick up where you left off.
        </p>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteListingButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Delete draft"
      onClick={async () => {
        setBusy(true)
        const res = await deleteOrgListing(id)
        setBusy(false)
        if (!res.ok) toast.error(res.error ?? 'Could not delete')
      }}
      className="text-[#95979d] hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  )
}

export function ListingStatusButton({
  id,
  action,
  disabledReason = null,
}: {
  id: string
  action: 'submit' | 'withdraw'
  disabledReason?: string | null
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant={action === 'submit' ? 'default' : 'outline'}
      disabled={busy || !!disabledReason}
      title={disabledReason ?? undefined}
      className={action === 'submit' ? 'bg-[#1dbf73] text-white hover:bg-[#19a463]' : ''}
      onClick={async () => {
        setBusy(true)
        const res = action === 'submit' ? await submitOrgListing(id) : await withdrawOrgListing(id)
        setBusy(false)
        if (!res.ok) toast.error(res.error ?? 'Something went wrong')
        else toast.success(action === 'submit' ? 'Submitted for review' : 'Moved back to drafts')
      }}
    >
      {action === 'submit' ? 'Submit for review' : 'Withdraw'}
    </Button>
  )
}
