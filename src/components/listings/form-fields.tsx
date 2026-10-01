'use client'

/*
 * Form fields for the listing editor. Copied from the onboarding wizard
 * (src/app/onboarding/professional/ui.tsx) so the provider area doesn't
 * depend on wizard internals.
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const PRIMARY_BTN =
  'h-11 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]'

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
