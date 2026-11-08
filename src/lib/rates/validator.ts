import { z } from 'zod'
import { RATE_UNITS, type ProfessionalRate } from './types'

// Form-level validation for the rates editor (/contractor/rates). Pure: used
// on the client for inline errors and again in the server actions.

export const PRICE_MODES = ['fixed', 'range', 'on_request'] as const
export type PriceMode = (typeof PRICE_MODES)[number]

export const MAX_RATES = 30
const MAX_DOLLARS = 1_000_000

/** What the editor form holds. Money is typed in dollars as text. */
export interface RateFormValues {
  label: string
  description: string
  unit: (typeof RATE_UNITS)[number]
  unit_label: string
  duration_minutes: string
  price_mode: PriceMode
  amount: string
  amount_max: string
  is_active: boolean
}

export const EMPTY_RATE_FORM: RateFormValues = {
  label: '',
  description: '',
  unit: 'session',
  unit_label: '',
  duration_minutes: '60',
  price_mode: 'fixed',
  amount: '',
  amount_max: '',
  is_active: true,
}

/** Columns written to professional_rates (minus contractor_id / sort_order). */
export type RateColumns = Pick<
  ProfessionalRate,
  | 'label'
  | 'description'
  | 'unit'
  | 'unit_label'
  | 'duration_minutes'
  | 'amount_cents'
  | 'amount_max_cents'
  | 'on_request'
  | 'is_active'
>

const dollars = (field: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[$,\s]/g, ''))
    .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), {
      message: `Enter ${field} like 120 or 99.50`,
    })
    .refine((v) => v === '' || Number(v) <= MAX_DOLLARS, {
      message: 'That amount is too large',
    })

const toCents = (v: string): number | null =>
  v === '' ? null : Math.round(Number(v) * 100)

export const rateFormSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, 'Give this rate a name')
      .max(120, 'Keep the name under 120 characters'),
    description: z.string().trim().max(1000, 'Keep the description under 1000 characters'),
    unit: z.enum(RATE_UNITS),
    unit_label: z.string().trim().max(60, 'Keep this under 60 characters'),
    duration_minutes: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 24 * 60), {
        message: 'Enter minutes between 1 and 1440',
      }),
    price_mode: z.enum(PRICE_MODES),
    amount: dollars('a price'),
    amount_max: dollars('a maximum'),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.unit === 'custom' && v.unit_label === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['unit_label'],
        message: 'Describe the unit, e.g. “per visit”',
      })
    }
    if (v.price_mode === 'on_request') return
    if (v.amount === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: v.price_mode === 'range' ? 'Enter the starting price' : 'Enter a price',
      })
    }
    if (v.price_mode === 'range') {
      if (v.amount_max === '') {
        ctx.addIssue({ code: 'custom', path: ['amount_max'], message: 'Enter the top of the range' })
      } else if (v.amount !== '' && Number(v.amount_max) <= Number(v.amount)) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount_max'],
          message: 'Must be higher than the starting price',
        })
      }
    }
  })
  .transform(
    (v): RateColumns => ({
      label: v.label,
      description: v.description || null,
      unit: v.unit,
      // unit_label is meaningful for custom units and package notes only.
      unit_label: v.unit === 'custom' || v.unit === 'package' ? v.unit_label || null : null,
      duration_minutes:
        v.unit === 'session' && v.duration_minutes !== '' ? Number(v.duration_minutes) : null,
      on_request: v.price_mode === 'on_request',
      amount_cents: v.price_mode === 'on_request' ? null : toCents(v.amount),
      amount_max_cents: v.price_mode === 'range' ? toCents(v.amount_max) : null,
      is_active: v.is_active,
    })
  )

export type RateFieldErrors = Partial<Record<keyof RateFormValues, string>>

export function rateFieldErrors(issues: z.core.$ZodIssue[]): RateFieldErrors {
  const out: RateFieldErrors = {}
  for (const i of issues) {
    const k = i.path[0] as keyof RateFormValues | undefined
    if (k && !out[k]) out[k] = i.message
  }
  return out
}

const centsToText = (c: number | null) =>
  c == null ? '' : c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2)

/** Existing row → form values. */
export function rateToForm(r: ProfessionalRate): RateFormValues {
  return {
    label: r.label,
    description: r.description ?? '',
    unit: r.unit,
    unit_label: r.unit_label ?? '',
    duration_minutes: r.duration_minutes != null ? String(r.duration_minutes) : '',
    price_mode: r.on_request
      ? 'on_request'
      : r.amount_max_cents != null && r.amount_cents != null && r.amount_max_cents > r.amount_cents
        ? 'range'
        : 'fixed',
    amount: centsToText(r.amount_cents),
    amount_max: centsToText(r.amount_max_cents),
    is_active: r.is_active,
  }
}

/**
 * Best-effort preview of a half-filled form (no validation), so the editor
 * can show "$120 / 60-min session" as the professional types.
 */
export function formToPreview(v: RateFormValues): Pick<
  ProfessionalRate,
  'unit' | 'unit_label' | 'duration_minutes' | 'amount_cents' | 'amount_max_cents' | 'on_request'
> {
  const cents = (s: string) => {
    const n = Number(s.replace(/[$,\s]/g, ''))
    return s.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100)
  }
  const mins = Number(v.duration_minutes)
  return {
    unit: v.unit,
    unit_label: v.unit_label.trim() || null,
    duration_minutes: v.unit === 'session' && mins > 0 ? Math.round(mins) : null,
    on_request: v.price_mode === 'on_request',
    amount_cents: v.price_mode === 'on_request' ? null : cents(v.amount),
    amount_max_cents: v.price_mode === 'range' ? cents(v.amount_max) : null,
  }
}

/** Legacy contractor_profiles.hourly_rate_min/max (dollars) → a suggested rate. */
export function legacyHourlyToForm(min: number | null, max: number | null): RateFormValues | null {
  const lo = min ?? max
  if (lo == null || lo < 0) return null
  const hi = max != null && max > lo ? max : null
  return {
    ...EMPTY_RATE_FORM,
    label: 'Hourly rate',
    unit: 'hour',
    duration_minutes: '',
    price_mode: hi != null ? 'range' : 'fixed',
    amount: String(lo),
    amount_max: hi != null ? String(hi) : '',
  }
}
