'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Check,
  Loader2,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveListing } from '@/app/(dashboard)/contractor/listings/actions'
import {
  ENGAGEMENT_TYPES,
  EVENT_TYPES,
  MEDICAL_PROCEDURES_LABEL,
  SERVICE_FORMATS,
  emptyListing,
  isoToLocalInput,
  needsMalpractice,
  type ListingDraft,
  type ListingStatus,
  type OfferingKind,
} from '@/lib/listings/offering'
import {
  PRIMARY_BTN,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
} from './form-fields'

const KINDS: { kind: OfferingKind; label: string; sub: string; icon: React.ElementType }[] = [
  { kind: 'service', label: 'Service', sub: 'Bookable sessions or visits', icon: Stethoscope },
  { kind: 'consulting', label: 'Consulting', sub: 'Advisory work and projects', icon: Briefcase },
  { kind: 'event', label: 'Event or class', sub: 'Workshops, classes, CEU courses', icon: CalendarDays },
]

export function ListingForm({
  listingId,
  initial,
  status,
  insured,
}: {
  listingId: string | null
  /** starts_at may be ISO; converted to the local datetime-local value here. */
  initial: ListingDraft | null
  status?: ListingStatus
  /** Provider has a reviewed malpractice certificate. */
  insured: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<ListingDraft | null>(() =>
    initial
      ? { ...initial, starts_at: initial.starts_at ? isoToLocalInput(initial.starts_at) : '' }
      : null
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const [intent, setIntent] = useState<'save' | 'review' | null>(null)

  function update(patch: Partial<ListingDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch)) delete next[k]
      return next
    })
  }

  function save(then: 'save' | 'review') {
    if (!draft) return
    const payload = {
      ...draft,
      starts_at:
        draft.kind === 'event' && !draft.date_later && draft.starts_at
          ? new Date(draft.starts_at).toISOString()
          : '',
    }
    setIntent(then)
    startTransition(async () => {
      const res = await saveListing(listingId, payload)
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        toast.error(res.error)
        return
      }
      toast.success('Saved as a draft.')
      router.push(
        then === 'review'
          ? `/contractor/listings/${res.id}/review`
          : '/contractor/listings'
      )
      router.refresh()
    })
  }

  if (!draft) {
    return (
      <div>
        <h2 className="text-base font-semibold text-[#404145]">
          What kind of listing is this?
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {KINDS.map((k) => {
            const Icon = k.icon
            return (
              <button
                key={k.kind}
                type="button"
                onClick={() => setDraft(emptyListing(k.kind))}
                className="flex flex-col items-start gap-2 rounded-xl border border-[#e4e5e7] bg-white p-4 text-left transition hover:border-[#bcebd5] hover:bg-[#fafefb]"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-[#f7f7f7] text-[#62646a]">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#404145]">{k.label}</p>
                  <p className="mt-0.5 text-xs text-[#62646a]">{k.sub}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const requiresMalpractice = needsMalpractice(draft)
  const kindMeta = KINDS.find((k) => k.kind === draft.kind)!

  return (
    <div className="space-y-6">
      {status && status !== 'draft' && (
        <div className="flex items-start gap-2 rounded-lg border border-[#f5deb3] bg-[#fdf6e3] p-3 text-sm text-[#6b5208]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            {status === 'published'
              ? 'This listing is live. Saving changes takes it offline and back to a draft until you submit it and we review it again.'
              : 'Saving changes turns this listing back into a draft. Submit it for review again when you’re ready.'}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-[#62646a]">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f3f4f6] px-2 py-1 font-medium text-[#404145]">
          <Check className="size-3.5 text-[#1dbf73]" />
          {kindMeta.label}
        </span>
        {listingId === null && (
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="font-medium text-[#1dbf73] hover:underline"
          >
            Change
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[#e4e5e7] bg-white p-5">
        <ListingFields draft={draft} errors={errors} onChange={update} />
      </div>

      {requiresMalpractice && (
        <div className="flex items-start gap-2 rounded-lg border border-[#e4e5e7] bg-[#fafafa] p-3 text-sm text-[#404145]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#8a6508]" aria-hidden="true" />
          <p>
            In-person care, home visits, prescribing, injectables, and IVs need
            malpractice coverage.{' '}
            {insured ? (
              'Your certificate is on file and reviewed.'
            ) : (
              <>
                This listing can go live only after your malpractice
                certificate is reviewed.{' '}
                <Link
                  href="/contractor/credentials/upload?type=malpractice_insurance"
                  className="font-semibold text-[#1dbf73] hover:underline"
                >
                  Upload malpractice certificate
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          render={<Link href="/contractor/listings" />}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={() => save('save')}
        >
          {pending && intent === 'save' && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save draft
        </Button>
        <Button
          type="button"
          className={PRIMARY_BTN}
          disabled={pending}
          onClick={() => save('review')}
        >
          {pending && intent === 'review' && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save and review
        </Button>
      </div>
    </div>
  )
}

function ListingFields({
  draft: item,
  errors,
  onChange,
}: {
  draft: ListingDraft
  errors: Record<string, string>
  onChange: (patch: Partial<ListingDraft>) => void
}) {
  const id = (f: string) => `listing-${f}`
  const err = (f: string) => errors[f]
  const medical = (
    <Toggle
      id={id('medical')}
      checked={item.involves_medical_procedures}
      onChange={(v) => onChange({ involves_medical_procedures: v })}
      label={MEDICAL_PROCEDURES_LABEL}
    />
  )

  if (item.kind === 'service') {
    return (
      <div className="space-y-4">
        <TextField id={id('title')} label="Service name" value={item.title} onChange={(v) => onChange({ title: v })} error={err('title')} placeholder="e.g., Initial nutrition consult" />
        <TextAreaField id={id('description')} label="Short description" optional value={item.description} onChange={(v) => onChange({ description: v })} error={err('description')} maxLength={1000} rows={3} />
        <SelectField id={id('format')} label="Format" value={item.format} onChange={(v) => onChange({ format: v as ListingDraft['format'] })} options={SERVICE_FORMATS} error={err('format')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id={id('price')} label="Price (USD)" value={item.price} onChange={(v) => onChange({ price: v })} error={err('price')} inputMode="decimal" placeholder="e.g., 120" />
          <TextField id={id('duration')} label="Duration (minutes)" value={item.duration_minutes} onChange={(v) => onChange({ duration_minutes: v.replace(/\D/g, '').slice(0, 4) })} error={err('duration_minutes')} inputMode="numeric" placeholder="e.g., 60" />
        </div>
        {medical}
      </div>
    )
  }

  if (item.kind === 'consulting') {
    return (
      <div className="space-y-4">
        <TextField id={id('title')} label="Area" value={item.title} onChange={(v) => onChange({ title: v })} error={err('title')} placeholder="e.g., HIPAA compliance program build-out" />
        <TextAreaField id={id('description')} label="Description" optional value={item.description} onChange={(v) => onChange({ description: v })} error={err('description')} maxLength={1000} rows={3} />
        <SelectField id={id('engagement')} label="Engagement type" value={item.engagement_type} onChange={(v) => onChange({ engagement_type: v })} options={ENGAGEMENT_TYPES} error={err('engagement_type')} />
        <TextField
          id={id('price')}
          label="Starting rate (USD)"
          value={item.custom_quote ? '' : item.price}
          onChange={(v) => onChange({ price: v })}
          error={err('price')}
          inputMode="decimal"
          placeholder={item.custom_quote ? 'Custom quotes' : 'e.g., 200'}
          disabled={item.custom_quote}
        />
        <div className="flex flex-col gap-2">
          <Toggle id={id('custom_quote')} checked={item.custom_quote} onChange={(v) => onChange({ custom_quote: v })} label="I send custom quotes" />
          {medical}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SelectField id={id('event_type')} label="Type" value={item.event_type} onChange={(v) => onChange({ event_type: v })} options={EVENT_TYPES} error={err('event_type')} />
      <TextField id={id('title')} label="Title" value={item.title} onChange={(v) => onChange({ title: v })} error={err('title')} placeholder="e.g., Wound care essentials (2 CE hours)" />
      <TextAreaField id={id('description')} label="Description" optional value={item.description} onChange={(v) => onChange({ description: v })} error={err('description')} maxLength={2000} rows={3} />
      <div className="space-y-2">
        <TextField
          id={id('starts_at')}
          label="Date"
          type="datetime-local"
          value={item.date_later ? '' : item.starts_at}
          onChange={(v) => onChange({ starts_at: v })}
          error={err('starts_at')}
          disabled={item.date_later}
        />
        <Toggle id={id('date_later')} checked={item.date_later} onChange={(v) => onChange({ date_later: v })} label="I'll set the date later" />
      </div>
      <TextField id={id('capacity')} label="Capacity" optional value={item.capacity} onChange={(v) => onChange({ capacity: v.replace(/\D/g, '').slice(0, 5) })} error={err('capacity')} inputMode="numeric" placeholder="Max attendees" />
      <div className="space-y-2">
        <TextField
          id={id('price')}
          label="Price per attendee (USD)"
          value={item.is_free ? '' : item.price}
          onChange={(v) => onChange({ price: v })}
          error={err('price')}
          inputMode="decimal"
          placeholder={item.is_free ? 'Free' : 'e.g., 49'}
          disabled={item.is_free}
        />
        <div className="flex flex-col gap-2">
          <Toggle id={id('is_free')} checked={item.is_free} onChange={(v) => onChange({ is_free: v })} label="Free" />
          {medical}
        </div>
      </div>
    </div>
  )
}
