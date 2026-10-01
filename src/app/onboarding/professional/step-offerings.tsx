'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Check,
  Loader2,
  Plus,
  Stethoscope,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveOfferings, skipOfferings } from './actions'
import {
  ENGAGEMENT_TYPES,
  EVENT_TYPES,
  PRICE_FEE_NOTE,
  SERVICE_FORMATS,
  emptyOffering,
  type OfferingDraft,
  type OfferingKind,
} from './shared'
import {
  PRIMARY_BTN,
  SelectField,
  StepHeading,
  TextAreaField,
  TextField,
  Toggle,
} from './ui'

type Item = OfferingDraft & { uid: string }

const KINDS: { kind: OfferingKind; label: string; sub: string; icon: React.ElementType; noun: string }[] = [
  { kind: 'service', label: 'Services', sub: 'Bookable sessions or visits', icon: Stethoscope, noun: 'service' },
  { kind: 'consulting', label: 'Consulting', sub: 'Advisory work and projects', icon: Briefcase, noun: 'consulting offer' },
  { kind: 'event', label: 'Events & education', sub: 'Workshops, classes, CEU courses', icon: CalendarDays, noun: 'event' },
]

let uidCounter = 0
const newUid = () => `o${++uidCounter}`

/** ISO → value for <input type="datetime-local"> in the viewer's timezone. */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function StepOfferings({
  initial,
  onBack,
  onDone,
}: {
  initial: OfferingDraft[]
  onBack: () => void
  onDone: () => void
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((o) => ({ ...o, starts_at: o.starts_at ? isoToLocalInput(o.starts_at) : '', uid: newUid() }))
  )
  const [selected, setSelected] = useState<Set<OfferingKind>>(
    () => new Set(initial.map((o) => o.kind))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const [skipping, setSkipping] = useState(false)

  function toggleKind(kind: OfferingKind) {
    const next = new Set(selected)
    if (next.has(kind)) {
      next.delete(kind)
    } else {
      next.add(kind)
      if (!items.some((i) => i.kind === kind)) {
        setItems((p) => [...p, { ...emptyOffering(kind), uid: newUid() }])
      }
    }
    setSelected(next)
  }

  function update(uid: string, patch: Partial<OfferingDraft>) {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)))
    setErrors((e) => {
      const keys = Object.keys(patch)
      const next = { ...e }
      for (const k of keys) delete next[`${uid}.${k}`]
      return next
    })
  }

  function submit() {
    const chosen = items.filter((i) => selected.has(i.kind))
    if (chosen.length === 0) {
      toast.error("Choose at least one, or skip and set this up later.")
      return
    }
    const payload = chosen.map(({ uid: _uid, ...o }) => {
      void _uid
      return {
        ...o,
        starts_at:
          o.kind === 'event' && !o.date_later && o.starts_at
            ? new Date(o.starts_at).toISOString()
            : '',
      }
    })
    startTransition(async () => {
      const res = await saveOfferings(payload)
      if (!res.ok) {
        // Server keys errors by array index; re-key them by item uid.
        const mapped: Record<string, string> = {}
        for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) {
          const [idx, ...rest] = k.split('.')
          const item = chosen[Number(idx)]
          if (item) mapped[`${item.uid}.${rest.join('.')}`] = msg
        }
        setErrors(mapped)
        toast.error(res.error)
        return
      }
      onDone()
    })
  }

  async function skip() {
    setSkipping(true)
    try {
      const res = await skipOfferings()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onDone()
    } finally {
      setSkipping(false)
    }
  }

  const busy = pending || skipping

  return (
    <div>
      <StepHeading title="What will you offer?" sub="Select all that apply." />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {KINDS.map((k) => {
          const Icon = k.icon
          const on = selected.has(k.kind)
          return (
            <button
              key={k.kind}
              type="button"
              aria-pressed={on}
              onClick={() => toggleKind(k.kind)}
              className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition ${
                on
                  ? 'border-[#1dbf73] bg-[#e8faf1]'
                  : 'border-[#e4e5e7] bg-white hover:border-[#bcebd5] hover:bg-[#fafefb]'
              }`}
            >
              <div
                className={`flex size-9 items-center justify-center rounded-lg ${
                  on ? 'bg-[#1dbf73] text-white' : 'bg-[#f7f7f7] text-[#62646a]'
                }`}
              >
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#404145]">{k.label}</p>
                <p className="mt-0.5 text-xs text-[#62646a]">{k.sub}</p>
              </div>
              {on && <Check className="absolute right-3 top-3 size-4 text-[#1dbf73]" />}
            </button>
          )
        })}
      </div>

      {KINDS.filter((k) => selected.has(k.kind)).map((k) => {
        const list = items.filter((i) => i.kind === k.kind)
        return (
          <section key={k.kind} className="mt-8">
            <h2 className="text-base font-bold text-[#404145]">{k.label}</h2>
            <div className="mt-3 space-y-4">
              {list.map((item, n) => (
                <div key={item.uid} className="rounded-xl border border-[#e4e5e7] p-4">
                  {list.length > 1 && (
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#95979d]">
                        {k.noun} {n + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => setItems((p) => p.filter((i) => i.uid !== item.uid))}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#c0392b] hover:underline"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </button>
                    </div>
                  )}
                  <OfferingFields
                    item={item}
                    errors={errors}
                    onChange={(patch) => update(item.uid, patch)}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setItems((p) => [...p, { ...emptyOffering(k.kind), uid: newUid() }])}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1dbf73] hover:text-[#19a463]"
            >
              <Plus className="size-4" />
              Add another {k.noun}
            </button>
          </section>
        )
      })}

      <div className="mt-8 flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={busy} className="h-11 flex-1">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy || selected.size === 0}
          className={`flex-1 ${PRIMARY_BTN}`}
        >
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Submit
        </Button>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={skip}
          disabled={busy}
          className="text-sm font-medium text-[#62646a] underline-offset-4 hover:text-[#404145] hover:underline disabled:opacity-50"
        >
          {skipping ? 'Saving…' : "Skip, I'll set this up later"}
        </button>
      </div>
    </div>
  )
}

function FeeNote() {
  return <p className="text-xs text-[#62646a]">{PRICE_FEE_NOTE}</p>
}

function OfferingFields({
  item,
  errors,
  onChange,
}: {
  item: Item
  errors: Record<string, string>
  onChange: (patch: Partial<OfferingDraft>) => void
}) {
  const id = (f: string) => `${item.uid}-${f}`
  const err = (f: string) => errors[`${item.uid}.${f}`]

  if (item.kind === 'service') {
    return (
      <div className="space-y-4">
        <TextField id={id('title')} label="Service name" value={item.title} onChange={(v) => onChange({ title: v })} error={err('title')} placeholder="e.g., Initial nutrition consult" />
        <TextAreaField id={id('description')} label="Short description" optional value={item.description} onChange={(v) => onChange({ description: v })} error={err('description')} maxLength={1000} rows={2} />
        <SelectField id={id('format')} label="Format" value={item.format} onChange={(v) => onChange({ format: v as OfferingDraft['format'] })} options={SERVICE_FORMATS} error={err('format')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id={id('price')} label="Price (USD)" value={item.price} onChange={(v) => onChange({ price: v })} error={err('price')} inputMode="decimal" placeholder="e.g., 120" />
          <TextField id={id('duration')} label="Duration (minutes)" value={item.duration_minutes} onChange={(v) => onChange({ duration_minutes: v.replace(/\D/g, '').slice(0, 4) })} error={err('duration_minutes')} inputMode="numeric" placeholder="e.g., 60" />
        </div>
        <FeeNote />
      </div>
    )
  }

  if (item.kind === 'consulting') {
    return (
      <div className="space-y-4">
        <TextField id={id('title')} label="Area" value={item.title} onChange={(v) => onChange({ title: v })} error={err('title')} placeholder="e.g., HIPAA compliance program build-out" />
        <TextAreaField id={id('description')} label="Description" optional value={item.description} onChange={(v) => onChange({ description: v })} error={err('description')} maxLength={1000} rows={2} />
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
        <Toggle id={id('custom_quote')} checked={item.custom_quote} onChange={(v) => onChange({ custom_quote: v })} label="I send custom quotes" />
        <FeeNote />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SelectField id={id('event_type')} label="Type" value={item.event_type} onChange={(v) => onChange({ event_type: v })} options={EVENT_TYPES} error={err('event_type')} />
      <TextField id={id('title')} label="Title" value={item.title} onChange={(v) => onChange({ title: v })} error={err('title')} placeholder="e.g., Wound care essentials (2 CE hours)" />
      <TextAreaField id={id('description')} label="Description" optional value={item.description} onChange={(v) => onChange({ description: v })} error={err('description')} maxLength={2000} rows={2} />
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
        <Toggle id={id('is_free')} checked={item.is_free} onChange={(v) => onChange({ is_free: v })} label="Free" />
      </div>
      <FeeNote />
    </div>
  )
}
