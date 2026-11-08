// Flexible professional rates (table professional_rates). Pure: safe on
// server and client. Rates are shown on the full profile page only, never
// on search or listing cards.

export const RATE_UNITS = ['session', 'hour', 'day', 'week', 'month', 'package', 'custom'] as const
export type RateUnit = (typeof RATE_UNITS)[number]

export const RATE_UNIT_LABEL: Record<RateUnit, string> = {
  session: 'Per session',
  hour: 'Per hour',
  day: 'Per day',
  week: 'Per week',
  month: 'Per month',
  package: 'Package',
  custom: 'Custom',
}

export interface ProfessionalRate {
  id: string
  contractor_id: string
  label: string
  description: string | null
  unit: RateUnit
  unit_label: string | null
  duration_minutes: number | null
  amount_cents: number | null
  amount_max_cents: number | null
  on_request: boolean
  sort_order: number
  is_active: boolean
}

export const RATE_COLUMNS =
  'id, contractor_id, label, description, unit, unit_label, duration_minutes, amount_cents, amount_max_cents, on_request, sort_order, is_active'

const usd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })

/** "$120", "$80–$120", or "Contact for pricing". */
export function formatRateAmount(r: Pick<ProfessionalRate, 'amount_cents' | 'amount_max_cents' | 'on_request'>): string {
  if (r.on_request || r.amount_cents == null) return 'Contact for pricing'
  if (r.amount_max_cents != null && r.amount_max_cents > r.amount_cents) {
    return `${usd(r.amount_cents)}–${usd(r.amount_max_cents)}`
  }
  return usd(r.amount_cents)
}

/** "/ hour", "/ 60-min session", "/ per visit", "" for packages. */
export function formatRateUnit(r: Pick<ProfessionalRate, 'unit' | 'unit_label' | 'duration_minutes' | 'on_request'>): string {
  if (r.on_request) return ''
  switch (r.unit) {
    case 'session':
      return r.duration_minutes ? `/ ${r.duration_minutes}-min session` : '/ session'
    case 'custom':
      return r.unit_label ? `/ ${r.unit_label.replace(/^(per|\/)\s*/i, '')}` : ''
    case 'package':
      return r.unit_label ? `· ${r.unit_label}` : '· package'
    default:
      return `/ ${r.unit}`
  }
}
