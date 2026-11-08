import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { listOwnRates } from '@/lib/rates/data'
import type { ProfessionalRate } from '@/lib/rates/types'
import { RatesEditor } from './rates-editor'

export const metadata: Metadata = { title: 'Rates — Sanus' }

const DEMO_RATES: ProfessionalRate[] = [
  {
    id: 'demo-rate-1',
    contractor_id: DEMO_CONTRACTOR.id,
    label: 'Private duty shift',
    description: 'Includes charting and handoff report.',
    unit: 'hour',
    unit_label: null,
    duration_minutes: null,
    amount_cents: 5500,
    amount_max_cents: 8500,
    on_request: false,
    sort_order: 0,
    is_active: true,
  },
  {
    id: 'demo-rate-2',
    contractor_id: DEMO_CONTRACTOR.id,
    label: 'Wellness consult',
    description: null,
    unit: 'session',
    unit_label: null,
    duration_minutes: 60,
    amount_cents: 12000,
    amount_max_cents: null,
    on_request: false,
    sort_order: 1,
    is_active: true,
  },
]

export default async function RatesPage() {
  if (isDemoMode()) {
    return (
      <RatesEditor
        initialRates={DEMO_RATES}
        legacyHourly={null}
        available
        demo
      />
    )
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/contractor/rates')

  const [{ rates, available }, { data: profile }] = await Promise.all([
    listOwnRates(supabase, user.id),
    supabase
      .from('contractor_profiles')
      .select('hourly_rate_min, hourly_rate_max')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const min = (profile?.hourly_rate_min as number | null | undefined) ?? null
  const max = (profile?.hourly_rate_max as number | null | undefined) ?? null
  const legacyHourly =
    available && rates.length === 0 && (min != null || max != null) ? { min, max } : null

  return (
    <RatesEditor
      initialRates={rates}
      legacyHourly={legacyHourly}
      available={available}
      demo={false}
    />
  )
}
