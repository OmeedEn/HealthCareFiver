'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarClock,
  Clock,
  EyeOff,
  Loader2,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  CalendarDays,
  CalendarRange,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  RATE_UNITS,
  RATE_UNIT_LABEL,
  formatRateAmount,
  formatRateUnit,
  type ProfessionalRate,
  type RateUnit,
} from '@/lib/rates/types'
import {
  EMPTY_RATE_FORM,
  MAX_RATES,
  formToPreview,
  legacyHourlyToForm,
  rateFieldErrors,
  rateFormSchema,
  rateToForm,
  type PriceMode,
  type RateFieldErrors,
  type RateFormValues,
} from '@/lib/rates/validator'
import {
  createRate,
  deleteRate,
  importLegacyHourlyRate,
  reorderRates,
  setRateActive,
  updateRate,
} from '@/lib/rates/actions'

const GREEN = 'bg-[#2f3cf5] text-white hover:bg-[#2330c8]'

const UNIT_META: Record<RateUnit, { icon: typeof Clock; hint: string; placeholder: string }> = {
  session: { icon: CalendarClock, hint: 'A visit or appointment', placeholder: 'Wellness consult' },
  hour: { icon: Clock, hint: 'Billed by the hour', placeholder: 'Private duty nursing' },
  day: { icon: Sun, hint: 'A full-day or shift rate', placeholder: 'Day shift coverage' },
  week: { icon: CalendarDays, hint: 'Weekly engagement', placeholder: 'Weekly home care' },
  month: { icon: CalendarRange, hint: 'Retainer or monthly plan', placeholder: 'Monthly care plan' },
  package: { icon: Package, hint: 'A bundle at one price', placeholder: '5-session recovery package' },
  custom: { icon: Tag, hint: 'Your own unit', placeholder: 'Home visit' },
}

const DURATION_CHIPS = [30, 45, 60, 90]

let keySeq = 0
/** Monotonic id for dialog remount keys and demo-mode row ids. */
const nextKey = () => ++keySeq

const PRICE_MODE_LABEL: Record<PriceMode, string> = {
  fixed: 'Fixed price',
  range: 'Price range',
  on_request: 'Contact for pricing',
}

function RateLine({
  rate,
  muted = false,
}: {
  rate: Pick<
    ProfessionalRate,
    'unit' | 'unit_label' | 'duration_minutes' | 'amount_cents' | 'amount_max_cents' | 'on_request'
  >
  muted?: boolean
}) {
  const unit = formatRateUnit(rate)
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className={`text-base font-semibold ${muted ? 'text-[#5f5d57]' : 'text-[#1a1a17]'}`}>
        {formatRateAmount(rate)}
      </span>
      {unit && <span className="text-sm text-[#5f5d57]">{unit}</span>}
    </span>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f3cf5] disabled:opacity-50 ${
        checked ? 'bg-[#2f3cf5]' : 'bg-[#dadbdd]'
      }`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null
  return (
    <p id={id} className="text-xs text-red-600">
      {msg}
    </p>
  )
}

function MoneyInput({
  id,
  value,
  onChange,
  error,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#5f5d57]">
        $
      </span>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="pl-6"
      />
    </div>
  )
}

/* ─────────────────────────── Editor dialog ─────────────────────────── */

function RateDialog({
  open,
  onOpenChange,
  editing,
  initial,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: boolean
  initial: RateFormValues
  onSave: (v: RateFormValues) => Promise<RateFieldErrors | null>
}) {
  const [v, setV] = useState<RateFormValues>(initial)
  const [errors, setErrors] = useState<RateFieldErrors>({})
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof RateFormValues>(k: K, val: RateFormValues[K]) => {
    setV((prev) => ({ ...prev, [k]: val }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = rateFormSchema.safeParse(v)
    if (!parsed.success) {
      setErrors(rateFieldErrors(parsed.error.issues))
      return
    }
    setSaving(true)
    const fieldErrors = await onSave(v)
    setSaving(false)
    if (fieldErrors) setErrors(fieldErrors)
  }

  const preview = formToPreview(v)
  const meta = UNIT_META[v.unit]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <DialogHeader>
            <DialogTitle className="text-lg text-[#1a1a17]">
              {editing ? 'Edit rate' : 'Add a rate'}
            </DialogTitle>
            <DialogDescription className="text-[#5f5d57]">
              Clients see this on your full profile — never on search cards.
            </DialogDescription>
          </DialogHeader>

          {/* Live preview */}
          <div className="rounded-xl border border-[#c9cdfb] bg-[#f4f5fe] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#2330c8]">Preview</p>
            <p className="mt-1 text-sm font-medium text-[#1a1a17]">
              {v.label.trim() || meta.placeholder}
            </p>
            <div className="mt-0.5">
              <RateLine rate={preview} />
            </div>
            {v.description.trim() && (
              <p className="mt-1 line-clamp-2 text-sm text-[#5f5d57]">{v.description.trim()}</p>
            )}
          </div>

          {/* Unit */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[#1a1a17]">How do you charge?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATE_UNITS.map((u) => {
                const Icon = UNIT_META[u].icon
                const active = v.unit === u
                return (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('unit', u)}
                    className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-[#2f3cf5] ${
                      active
                        ? 'border-[#2f3cf5] bg-[#eceefe] text-[#2330c8]'
                        : 'border-[#e3dfd6] text-[#1a1a17] hover:border-[#c9cdfb]'
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="font-medium">{RATE_UNIT_LABEL[u]}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-[#5f5d57]">{meta.hint}</p>
          </fieldset>

          {v.unit === 'session' && (
            <div className="space-y-2">
              <Label htmlFor="rate-duration" className="text-[#1a1a17]">
                Session length <span className="font-normal text-[#706d65]">(optional)</span>
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {DURATION_CHIPS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('duration_minutes', String(m))}
                    className={`h-8 rounded-full border px-3 text-sm transition ${
                      v.duration_minutes === String(m)
                        ? 'border-[#2f3cf5] bg-[#eceefe] text-[#2330c8]'
                        : 'border-[#e3dfd6] text-[#1a1a17] hover:border-[#c9cdfb]'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
                <div className="flex items-center gap-1.5">
                  <Input
                    id="rate-duration"
                    inputMode="numeric"
                    value={v.duration_minutes}
                    onChange={(e) => set('duration_minutes', e.target.value)}
                    placeholder="Other"
                    aria-invalid={!!errors.duration_minutes}
                    className="h-8 w-20"
                  />
                  <span className="text-sm text-[#5f5d57]">min</span>
                </div>
              </div>
              <FieldError id="rate-duration-error" msg={errors.duration_minutes} />
            </div>
          )}

          {(v.unit === 'custom' || v.unit === 'package') && (
            <div className="space-y-2">
              <Label htmlFor="rate-unit-label" className="text-[#1a1a17]">
                {v.unit === 'custom' ? (
                  'Per what?'
                ) : (
                  <>
                    What’s included <span className="font-normal text-[#706d65]">(optional)</span>
                  </>
                )}
              </Label>
              <Input
                id="rate-unit-label"
                value={v.unit_label}
                onChange={(e) => set('unit_label', e.target.value)}
                placeholder={v.unit === 'custom' ? 'per visit, per patient, per event…' : '5 sessions'}
                maxLength={60}
                aria-invalid={!!errors.unit_label}
              />
              <FieldError id="rate-unit-label-error" msg={errors.unit_label} />
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="rate-label" className="text-[#1a1a17]">
              Name
            </Label>
            <Input
              id="rate-label"
              value={v.label}
              onChange={(e) => set('label', e.target.value)}
              placeholder={meta.placeholder}
              maxLength={120}
              aria-invalid={!!errors.label}
            />
            <FieldError id="rate-label-error" msg={errors.label} />
          </div>

          {/* Price */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[#1a1a17]">Price</legend>
            <div className="inline-flex flex-wrap rounded-lg border border-[#e3dfd6] p-0.5">
              {(Object.keys(PRICE_MODE_LABEL) as PriceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={v.price_mode === m}
                  onClick={() => set('price_mode', m)}
                  className={`h-8 rounded-md px-3 text-sm font-medium transition ${
                    v.price_mode === m ? 'bg-[#2f3cf5] text-white' : 'text-[#5f5d57] hover:text-[#1a1a17]'
                  }`}
                >
                  {PRICE_MODE_LABEL[m]}
                </button>
              ))}
            </div>
            {v.price_mode === 'on_request' ? (
              <p className="text-sm text-[#5f5d57]">
                Clients will see “Contact for pricing” and can message you for a quote.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rate-amount" className="text-xs text-[#5f5d57]">
                    {v.price_mode === 'range' ? 'From' : 'Amount (USD)'}
                  </Label>
                  <MoneyInput
                    id="rate-amount"
                    value={v.amount}
                    onChange={(x) => set('amount', x)}
                    error={errors.amount}
                    placeholder="120"
                  />
                  <FieldError id="rate-amount-error" msg={errors.amount} />
                </div>
                {v.price_mode === 'range' && (
                  <div className="space-y-1">
                    <Label htmlFor="rate-amount-max" className="text-xs text-[#5f5d57]">
                      To
                    </Label>
                    <MoneyInput
                      id="rate-amount-max"
                      value={v.amount_max}
                      onChange={(x) => set('amount_max', x)}
                      error={errors.amount_max}
                      placeholder="180"
                    />
                    <FieldError id="rate-amount-max-error" msg={errors.amount_max} />
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="rate-description" className="text-[#1a1a17]">
              Description <span className="font-normal text-[#706d65]">(optional)</span>
            </Label>
            <Textarea
              id="rate-description"
              value={v.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What's included, travel fees, minimums…"
              maxLength={1000}
              rows={3}
              aria-invalid={!!errors.description}
            />
            <FieldError id="rate-description-error" msg={errors.description} />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e3dfd6] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#1a1a17]">Show on my profile</p>
              <p className="text-xs text-[#5f5d57]">Turn off to keep it saved but hidden.</p>
            </div>
            <Toggle
              checked={v.is_active}
              onChange={(x) => set('is_active', x)}
              label="Show on my profile"
            />
          </div>

          <DialogFooter className="-mx-6 -mb-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className={GREEN}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add rate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────────────── Page ─────────────────────────── */

const TEMPLATES: { unit: RateUnit; label: string; form: Partial<RateFormValues> }[] = [
  { unit: 'session', label: '60-min session', form: { unit: 'session', duration_minutes: '60' } },
  { unit: 'hour', label: 'Hourly', form: { unit: 'hour', duration_minutes: '' } },
  { unit: 'day', label: 'Day rate', form: { unit: 'day', duration_minutes: '' } },
  { unit: 'month', label: 'Monthly', form: { unit: 'month', duration_minutes: '' } },
  { unit: 'package', label: 'Package', form: { unit: 'package', duration_minutes: '' } },
  { unit: 'custom', label: 'Custom', form: { unit: 'custom', duration_minutes: '' } },
]

export function RatesEditor({
  initialRates,
  legacyHourly,
  available,
  demo,
}: {
  initialRates: ProfessionalRate[]
  legacyHourly: { min: number | null; max: number | null } | null
  /** False when the professional_rates table isn't there yet. */
  available: boolean
  demo: boolean
}) {
  const [rates, setRates] = useState<ProfessionalRate[]>(initialRates)
  const [dialog, setDialog] = useState<{ key: number; editId: string | null; initial: RateFormValues } | null>(
    null
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [legacyDismissed, setLegacyDismissed] = useState(false)

  const legacyForm = legacyHourly ? legacyHourlyToForm(legacyHourly.min, legacyHourly.max) : null
  const showLegacy = !!legacyForm && rates.length === 0 && !legacyDismissed && available
  const atLimit = rates.length >= MAX_RATES
  const activeRates = rates.filter((r) => r.is_active)

  function openNew(partial: Partial<RateFormValues> = {}) {
    setDialog({ key: nextKey(), editId: null, initial: { ...EMPTY_RATE_FORM, ...partial } })
  }
  function openEdit(r: ProfessionalRate) {
    setDialog({ key: nextKey(), editId: r.id, initial: rateToForm(r) })
  }

  async function save(v: RateFormValues): Promise<RateFieldErrors | null> {
    const editId = dialog?.editId ?? null
    if (demo) {
      const parsed = rateFormSchema.parse(v)
      if (editId) {
        setRates((rs) => rs.map((r) => (r.id === editId ? { ...r, ...parsed } : r)))
      } else {
        setRates((rs) => [
          ...rs,
          { ...parsed, id: `demo-${nextKey()}`, contractor_id: 'demo', sort_order: rs.length },
        ])
      }
      toast.success(editId ? 'Rate updated' : 'Rate added')
      setDialog(null)
      return null
    }
    const res = editId ? await updateRate(editId, v) : await createRate(v)
    if (!res.ok) {
      toast.error(res.error)
      return res.fieldErrors ?? null
    }
    setRates((rs) => (editId ? rs.map((r) => (r.id === editId ? res.rate : r)) : [...rs, res.rate]))
    toast.success(editId ? 'Rate updated' : 'Rate added')
    setDialog(null)
    return null
  }

  async function toggleActive(r: ProfessionalRate, next: boolean) {
    setRates((rs) => rs.map((x) => (x.id === r.id ? { ...x, is_active: next } : x)))
    if (demo) return
    setBusyId(r.id)
    const res = await setRateActive(r.id, next)
    setBusyId(null)
    if (!res.ok) {
      setRates((rs) => rs.map((x) => (x.id === r.id ? { ...x, is_active: !next } : x)))
      toast.error(res.error)
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= rates.length) return
    const prev = rates
    const next = [...rates]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRates(next.map((r, i) => ({ ...r, sort_order: i })))
    if (demo) return
    const res = await reorderRates(next.map((r) => r.id))
    if (!res.ok) {
      setRates(prev)
      toast.error(res.error)
    }
  }

  async function remove(r: ProfessionalRate) {
    setConfirmDelete(null)
    if (demo) {
      setRates((rs) => rs.filter((x) => x.id !== r.id))
      toast.success('Rate removed')
      return
    }
    setBusyId(r.id)
    const res = await deleteRate(r.id)
    setBusyId(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setRates((rs) => rs.filter((x) => x.id !== r.id))
    toast.success('Rate removed')
  }

  async function importLegacy() {
    if (!legacyForm) return
    if (demo) {
      const parsed = rateFormSchema.parse(legacyForm)
      setRates([{ ...parsed, id: `demo-${nextKey()}`, contractor_id: 'demo', sort_order: 0 }])
      toast.success('Hourly rate imported')
      return
    }
    setImporting(true)
    const res = await importLegacyHourlyRate()
    setImporting(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setRates([res.rate])
    toast.success('Hourly rate imported — edit it any time')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a17]">Rates</h1>
          <p className="text-[#5f5d57]">
            Set how you charge — by session, hour, day, week, month, package, or your own unit.
          </p>
          <Link
            href="/contractor/availability"
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#2f3cf5] hover:text-[#2330c8]"
          >
            Set your availability <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <Button onClick={() => openNew()} disabled={!available || atLimit} className={GREEN}>
          <Plus className="mr-2 size-4" />
          Add rate
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-[#e3dfd6] bg-white px-4 py-3">
        <EyeOff className="mt-0.5 size-4 shrink-0 text-[#5f5d57]" aria-hidden="true" />
        <p className="text-sm text-[#5f5d57]">
          Your prices are private on search results. Clients only see them after they open your full
          profile — search cards just say “Rates on profile”.
        </p>
      </div>

      {!available && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Rates are being set up for your account. Check back shortly — nothing you’ve saved is lost.
        </div>
      )}

      {showLegacy && legacyForm && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#c9cdfb] bg-[#f4f5fe] p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-[#2f3cf5]" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-[#1a1a17]">Import your hourly rate</p>
              <p className="text-sm text-[#5f5d57]">
                Your profile lists{' '}
                <span className="font-medium text-[#1a1a17]">
                  {formatRateAmount(formToPreview(legacyForm))} {formatRateUnit(formToPreview(legacyForm))}
                </span>
                . Add it here as your first rate?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setLegacyDismissed(true)}>
              Not now
            </Button>
            <Button onClick={importLegacy} disabled={importing} className={GREEN}>
              {importing && <Loader2 className="mr-2 size-4 animate-spin" />}
              Import
            </Button>
          </div>
        </div>
      )}

      {rates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e3dfd6] bg-white px-6 py-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#eceefe]">
            <Tag className="size-6 text-[#2f3cf5]" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-[#1a1a17]">No rates yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#5f5d57]">
            Add as many as you like — a per-session price, a day rate, a monthly plan, or a package.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {TEMPLATES.map((t) => {
              const Icon = UNIT_META[t.unit].icon
              return (
                <button
                  key={t.unit}
                  type="button"
                  disabled={!available}
                  onClick={() => openNew(t.form)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e3dfd6] px-4 text-sm font-medium text-[#1a1a17] transition hover:border-[#2f3cf5] hover:text-[#2330c8] disabled:opacity-50"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <ul className="space-y-3">
            {rates.map((r, i) => {
              const Icon = UNIT_META[r.unit].icon
              const busy = busyId === r.id
              return (
                <li
                  key={r.id}
                  className={`rounded-xl border bg-white p-4 transition ${
                    r.is_active ? 'border-[#e3dfd6]' : 'border-dashed border-[#e3dfd6] bg-[#f6f4ef]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${r.label} up`}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => move(i, 1)}
                        disabled={i === rates.length - 1}
                        aria-label={`Move ${r.label} down`}
                      >
                        <ArrowDown />
                      </Button>
                    </div>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eceefe]">
                      <Icon className="size-4 text-[#2f3cf5]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-[#1a1a17]">{r.label}</h3>
                        <span className="rounded-md bg-[#eeebe4] px-2 py-0.5 text-xs text-[#5f5d57]">
                          {RATE_UNIT_LABEL[r.unit]}
                        </span>
                        {!r.is_active && (
                          <span className="rounded-md bg-[#eeebe4] px-2 py-0.5 text-xs font-medium text-[#706d65]">
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        <RateLine rate={r} muted={!r.is_active} />
                      </div>
                      {r.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-[#5f5d57]">{r.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                      <Toggle
                        checked={r.is_active}
                        onChange={(x) => toggleActive(r, x)}
                        label={`Show ${r.label} on profile`}
                        disabled={busy}
                      />
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(r)}
                          aria-label={`Edit ${r.label}`}
                        >
                          <Pencil />
                        </Button>
                        {confirmDelete === r.id ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => remove(r)}
                            onBlur={() => setConfirmDelete(null)}
                            disabled={busy}
                            autoFocus
                          >
                            Delete?
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setConfirmDelete(r.id)}
                            aria-label={`Delete ${r.label}`}
                            disabled={busy}
                          >
                            <Trash2 className="text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
            {!atLimit && (
              <li>
                <button
                  type="button"
                  onClick={() => openNew()}
                  disabled={!available}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#dadbdd] py-3 text-sm font-medium text-[#5f5d57] transition hover:border-[#2f3cf5] hover:text-[#2330c8] disabled:opacity-50"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add another rate
                </button>
              </li>
            )}
          </ul>

          {/* What clients see on the full profile */}
          <aside className="h-fit rounded-xl border border-[#e3dfd6] bg-white p-4 lg:sticky lg:top-6">
            <p className="text-xs font-medium uppercase tracking-wide text-[#706d65]">
              On your profile
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#1a1a17]">Rates</h2>
            {activeRates.length === 0 ? (
              <p className="mt-2 text-sm text-[#5f5d57]">
                No rates are visible. Clients will see “Contact for pricing”.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#eeebe4]">
                {activeRates.map((r) => (
                  <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm text-[#1a1a17]">{r.label}</p>
                    <RateLine rate={r} />
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}

      {dialog && (
        <RateDialog
          key={dialog.key}
          open
          onOpenChange={(o) => {
            if (!o) setDialog(null)
          }}
          editing={dialog.editId !== null}
          initial={dialog.initial}
          onSave={save}
        />
      )}
    </div>
  )
}
