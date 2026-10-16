'use client'

import { useId } from 'react'
import { Check, type LucideIcon } from 'lucide-react'
import { FieldError } from '@/app/onboarding/professional/ui'
import { FALLBACK_ICON, type ChoiceIcons } from './choice-icons'

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

type ChoiceOption = { value: string; label: string; sub?: string }
type Layout = { columns?: 1 | 2 | 3 | 4 | 5; compact?: boolean; stacked?: boolean }

const COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-3 sm:grid-cols-5',
} as const

/**
 * Single-select grid of icon buttons — the wizard's replacement for short
 * dropdowns. Arrow keys move between options; Enter or Space picks one.
 * `stacked` puts the icon above the label (narrow columns, e.g. sizes);
 * `compact` is a smaller row for tight spots (repeat rows, pay unit).
 */
export function IconChoices({
  legend,
  options,
  icons,
  value,
  onChange,
  error,
  columns = 3,
  compact = false,
  stacked = false,
  hideLegend = false,
}: {
  legend: string
  options: readonly ChoiceOption[]
  icons: ChoiceIcons
  value: string
  onChange: (v: string) => void
  error?: string
  hideLegend?: boolean
} & Layout) {
  const legendId = useId()

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!dir) return
    e.preventDefault()
    // Move focus only; Enter/Space picks. (Selecting on arrow would trigger
    // the wizard's auto-advance on the first keypress.)
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]'))
    const i = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement))
    buttons[(i + dir + buttons.length) % buttons.length]?.focus()
  }

  return (
    <div className="space-y-2">
      <p id={legendId} className={hideLegend ? 'sr-only' : 'text-sm font-semibold text-[#404145]'}>
        {legend}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={legendId}
        aria-invalid={error ? true : undefined}
        onKeyDown={onKeyDown}
        className={`grid gap-2.5 ${COLS[columns]}`}
      >
        {options.map((o, i) => {
          const on = value === o.value
          return (
            <ChoiceTile
              key={o.value}
              option={o}
              Icon={icons[o.value] ?? FALLBACK_ICON}
              on={on}
              role="radio"
              // Roving tab stop: the selected option (or the first) is tabbable.
              tabIndex={on || (!value && i === 0) ? 0 : -1}
              onClick={() => onChange(o.value)}
              compact={compact}
              stacked={stacked}
            />
          )
        })}
      </div>
      <FieldError msg={error} />
    </div>
  )
}

/** Multi-select version of IconChoices (same tiles, toggle on click). */
export function IconMultiChoices({
  legend,
  options,
  icons,
  value,
  onChange,
  error,
  columns = 3,
  compact = false,
  stacked = false,
  hideLegend = false,
}: {
  legend: string
  options: readonly ChoiceOption[]
  icons: ChoiceIcons
  value: string[]
  onChange: (v: string[]) => void
  error?: string
  hideLegend?: boolean
} & Layout) {
  const legendId = useId()
  return (
    <div className="space-y-2">
      <p id={legendId} className={hideLegend ? 'sr-only' : 'text-sm font-semibold text-[#404145]'}>
        {legend}
      </p>
      <div role="group" aria-labelledby={legendId} className={`grid gap-2.5 ${COLS[columns]}`}>
        {options.map((o) => {
          const on = value.includes(o.value)
          return (
            <ChoiceTile
              key={o.value}
              option={o}
              Icon={icons[o.value] ?? FALLBACK_ICON}
              on={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
              compact={compact}
              stacked={stacked}
            />
          )
        })}
      </div>
      <FieldError msg={error} />
    </div>
  )
}

function ChoiceTile({
  option,
  Icon,
  on,
  role,
  tabIndex,
  onClick,
  compact,
  stacked,
}: {
  option: ChoiceOption
  Icon: LucideIcon
  on: boolean
  role?: 'radio'
  tabIndex?: number
  onClick: () => void
  compact: boolean
  stacked: boolean
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? on : undefined}
      aria-pressed={role ? undefined : on}
      tabIndex={tabIndex}
      data-value={option.value}
      onClick={onClick}
      className={`relative flex rounded-xl border text-left transition outline-none focus-visible:ring-3 focus-visible:ring-[#1dbf73]/30 ${
        compact
          ? 'min-h-11 items-center gap-2 px-3 py-2 text-sm'
          : stacked
            ? 'min-h-24 flex-col items-start justify-between gap-3 p-3.5 text-sm'
            : 'min-h-[4.25rem] items-center gap-3 p-3 text-sm'
      } ${
        on
          ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f4c3a] shadow-[inset_0_0_0_1px_#1dbf73]'
          : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5] hover:bg-[#fafefb]'
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg ${compact ? 'size-7' : 'size-9'} ${
          on ? 'bg-[#1dbf73] text-white' : 'bg-[#f3f4f5] text-[#62646a]'
        }`}
      >
        <Icon className={compact ? 'size-4' : 'size-5'} />
      </span>
      <span className={compact || stacked ? '' : 'pr-5'}>
        <span className="block font-semibold leading-snug">{option.label}</span>
        {option.sub && <span className="mt-0.5 block text-xs font-normal text-[#62646a]">{option.sub}</span>}
      </span>
      {on && !compact && (
        <Check className="absolute top-2.5 right-2.5 size-3.5 text-[#1dbf73]" aria-hidden="true" />
      )}
    </button>
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
