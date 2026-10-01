'use client'

import { Check } from 'lucide-react'
import { FieldError } from '../../professional/ui'

/** Multi-select chips with separate values and labels. */
export function OptionChips({
  legend,
  options,
  value,
  onChange,
  error,
}: {
  legend: string
  options: readonly { value: string; label: string }[]
  value: string[]
  onChange: (v: string[]) => void
  error?: string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-[#404145]">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                on
                  ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                  : 'border-[#e4e5e7] bg-white text-[#62646a] hover:border-[#bcebd5]'
              }`}
            >
              {on && <Check className="size-3" />}
              {o.label}
            </button>
          )
        })}
      </div>
      <FieldError msg={error} />
    </fieldset>
  )
}

/** Save / skip row at the bottom of each quick-setup section. */
export function SectionActions({
  saving,
  onSave,
  onSkip,
  saveLabel = 'Save',
  skipLabel = 'Skip, I’ll set this up later',
}: {
  saving: boolean
  onSave: () => void
  onSkip?: () => void
  saveLabel?: string
  skipLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      {onSkip ? (
        <button type="button" onClick={onSkip} className="text-sm font-semibold text-[#62646a] hover:text-[#404145]">
          {skipLabel}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex h-10 items-center rounded-lg bg-[#1dbf73] px-5 text-sm font-semibold text-white hover:bg-[#19a463] disabled:opacity-60"
      >
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  )
}
