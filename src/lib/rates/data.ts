import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { RATE_COLUMNS, type ProfessionalRate } from './types'

type PgError = { code?: string; message?: string } | null

/**
 * True when professional_rates doesn't exist yet (migration not applied):
 * Postgres 42P01, or PostgREST's schema-cache miss PGRST205.
 */
export function isMissingRatesTable(err: PgError): boolean {
  if (!err) return false
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    /relation .*professional_rates.* does not exist|could not find the table .*professional_rates/i.test(
      err.message ?? ''
    )
  )
}

/**
 * A professional's own rates, in display order. Any query error (including a
 * missing table) is treated as "no rates" so pages never crash on it.
 */
export async function listOwnRates(
  supabase: SupabaseClient,
  contractorId: string
): Promise<{ rates: ProfessionalRate[]; available: boolean }> {
  const { data, error } = await supabase
    .from('professional_rates')
    .select(RATE_COLUMNS)
    .eq('contractor_id', contractorId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    if (!isMissingRatesTable(error)) {
      console.error('[rates] list failed', error.code, error.message)
    }
    return { rates: [], available: !isMissingRatesTable(error) }
  }
  return { rates: (data ?? []) as unknown as ProfessionalRate[], available: true }
}
