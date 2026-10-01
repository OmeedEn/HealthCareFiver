'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Check } from 'lucide-react'
import { TOTAL_STEPS } from './shared'

export const PRIMARY_BTN =
  'h-11 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]'

export function Progress({ step }: { step: number }) {
  const pct = (step / TOTAL_STEPS) * 100
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-[#62646a]">
        <span>
          Step {step} of {TOTAL_STEPS}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e5e7]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
        aria-label={`Step ${step} of ${TOTAL_STEPS}`}
      >
        <div
          className="h-full rounded-full bg-[#1dbf73] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function StepHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-[#404145]">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-[#62646a]">{sub}</p>}
    </div>
  )
}

export function FieldError({ id, msg }: { id?: string; msg?: string }) {
  if (!msg) return null
  return (
    <p id={id} className="text-xs text-red-600">
      {msg}
    </p>
  )
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  optional,
  placeholder,
  type = 'text',
  inputMode,
  list,
  hint,
  maxLength,
  disabled,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  optional?: boolean
  placeholder?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  list?: string
  hint?: string
  maxLength?: number
  disabled?: boolean
  autoComplete?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">
        {label}
        {optional && <span className="ml-1 font-normal text-[#95979d]">(optional)</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        list={list}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className="h-11 bg-white"
      />
      {hint && !error && <p className="text-xs text-[#62646a]">{hint}</p>}
      <FieldError id={`${id}-err`} msg={error} />
    </div>
  )
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  optional,
  placeholder,
  maxLength,
  counter,
  rows = 3,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  optional?: boolean
  placeholder?: string
  maxLength?: number
  counter?: boolean
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">
        {label}
        {optional && <span className="ml-1 font-normal text-[#95979d]">(optional)</span>}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className="bg-white"
      />
      <div className="flex items-start justify-between gap-3">
        <FieldError id={`${id}-err`} msg={error} />
        {counter && maxLength && (
          <p
            className={`ml-auto shrink-0 text-xs ${
              value.length >= maxLength ? 'text-red-600' : 'text-[#95979d]'
            }`}
            aria-live="polite"
          >
            {value.length}/{maxLength}
          </p>
        )}
      </div>
    </div>
  )
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  placeholder = 'Select…',
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly { value: string; label: string }[]
  error?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className="h-11 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-[#404145] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError msg={error} />
    </div>
  )
}

/** Toggleable chips for small multi-selects. */
export function ChipMultiSelect({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  error?: string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-[#404145]">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                on
                  ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                  : 'border-[#e4e5e7] bg-white text-[#62646a] hover:border-[#bcebd5]'
              }`}
            >
              {on && <Check className="size-3" />}
              {o}
            </button>
          )
        })}
      </div>
      <FieldError msg={error} />
    </fieldset>
  )
}

/** Single-choice radio cards (yes/no questions, credential basis, CEU, …). */
export function RadioCards<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  columns = 3,
}: {
  name: string
  legend: string
  options: readonly { value: T; label: string }[]
  value: T | ''
  onChange: (v: T) => void
  error?: string
  columns?: 2 | 3
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-[#404145]">{legend}</legend>
      <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'sm:grid-cols-3'}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition ${
              value === o.value
                ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5]'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="accent-[#1dbf73]"
            />
            {o.label}
          </label>
        ))}
      </div>
      <FieldError msg={error} />
    </fieldset>
  )
}

export const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

/** A checkbox with a wrapping text label (attestations). */
export function CheckRow({
  id,
  checked,
  onChange,
  label,
  error,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  error?: string
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-[#404145]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 size-4 shrink-0 rounded border-[#c5c6c9] accent-[#1dbf73]"
        />
        <span>{label}</span>
      </label>
      <FieldError msg={error} />
    </div>
  )
}

export function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#404145]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-[#c5c6c9] accent-[#1dbf73]"
      />
      {label}
    </label>
  )
}
