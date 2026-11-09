'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { currentUser, requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/demo/data'
import { isMissingRatesTable } from './data'
import { RATE_COLUMNS, type ProfessionalRate } from './types'
import {
  MAX_RATES,
  legacyHourlyToForm,
  rateFieldErrors,
  rateFormSchema,
  type RateFieldErrors,
} from './validator'

/*
 * Rate actions for /contractor/rates. Every action authenticates with
 * currentUser() (MFA/AAL2) + requireRole('contractor') and uses the caller's
 * own Supabase session, so RLS (professional_rates_own) is the real gate;
 * the contractor_id filters here just give clear "not found" results.
 */

export type RateResult =
  | { ok: true; rate: ProfessionalRate }
  | { ok: false; error: string; fieldErrors?: RateFieldErrors }

export type SimpleResult = { ok: true } | { ok: false; error: string }

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'
const NOT_READY = 'Rates aren’t available just yet — please try again shortly.'
const GENERIC = 'Something went wrong. Please try again.'
const idSchema = z.string().uuid()

async function session(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  if (isDemoMode()) return null
  try {
    const user = requireRole(await currentUser(), 'contractor')
    const supabase = (await createClient()) as unknown as SupabaseClient
    return { supabase, userId: user.id }
  } catch {
    return null
  }
}

function dbError(err: { code?: string; message?: string }): string {
  if (isMissingRatesTable(err)) return NOT_READY
  console.error('[rates] write failed', err.code, err.message)
  return GENERIC
}

function done() {
  revalidatePath('/contractor/rates')
}

export async function createRate(input: unknown): Promise<RateResult> {
  const parsed = rateFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: rateFieldErrors(parsed.error.issues),
    }
  }
  const s = await session()
  if (!s) return { ok: false, error: SESSION_EXPIRED }

  const { data: existing, error: countErr } = await s.supabase
    .from('professional_rates')
    .select('sort_order')
    .eq('contractor_id', s.userId)
    .order('sort_order', { ascending: false })
  if (countErr) return { ok: false, error: dbError(countErr) }
  if ((existing?.length ?? 0) >= MAX_RATES) {
    return { ok: false, error: `You can list up to ${MAX_RATES} rates.` }
  }
  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 0

  const { data, error } = await s.supabase
    .from('professional_rates')
    .insert({ ...parsed.data, contractor_id: s.userId, sort_order: nextOrder })
    .select(RATE_COLUMNS)
    .single()
  if (error || !data) return { ok: false, error: error ? dbError(error) : GENERIC }
  done()
  return { ok: true, rate: data as unknown as ProfessionalRate }
}

export async function updateRate(id: string, input: unknown): Promise<RateResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Rate not found.' }
  const parsed = rateFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: rateFieldErrors(parsed.error.issues),
    }
  }
  const s = await session()
  if (!s) return { ok: false, error: SESSION_EXPIRED }

  const { data, error } = await s.supabase
    .from('professional_rates')
    .update(parsed.data)
    .eq('id', id)
    .eq('contractor_id', s.userId)
    .select(RATE_COLUMNS)
    .maybeSingle()
  if (error) return { ok: false, error: dbError(error) }
  if (!data) return { ok: false, error: 'Rate not found.' }
  done()
  return { ok: true, rate: data as unknown as ProfessionalRate }
}

export async function setRateActive(id: string, isActive: boolean): Promise<SimpleResult> {
  if (!idSchema.safeParse(id).success || typeof isActive !== 'boolean') {
    return { ok: false, error: 'Rate not found.' }
  }
  const s = await session()
  if (!s) return { ok: false, error: SESSION_EXPIRED }
  const { data, error } = await s.supabase
    .from('professional_rates')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('contractor_id', s.userId)
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, error: dbError(error) }
  if (!data) return { ok: false, error: 'Rate not found.' }
  done()
  return { ok: true }
}

export async function deleteRate(id: string): Promise<SimpleResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Rate not found.' }
  const s = await session()
  if (!s) return { ok: false, error: SESSION_EXPIRED }
  const { error } = await s.supabase
    .from('professional_rates')
    .delete()
    .eq('id', id)
    .eq('contractor_id', s.userId)
  if (error) return { ok: false, error: dbError(error) }
  done()
  return { ok: true }
}

const reorderSchema = z.array(z.string().uuid()).min(1).max(MAX_RATES)

/** Persist a new order: ids[0] gets sort_order 0, and so on. */
export async function reorderRates(ids: unknown): Promise<SimpleResult> {
  const parsed = reorderSchema.safeParse(ids)
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) {
    return { ok: false, error: 'Couldn’t save the new order.' }
  }
  const s = await session()
  if (!s) return { ok: false, error: SESSION_EXPIRED }
  const results = await Promise.all(
    parsed.data.map((id, i) =>
      s.supabase
        .from('professional_rates')
        .update({ sort_order: i })
        .eq('id', id)
        .eq('contractor_id', s.userId)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: dbError(failed.error) }
  done()
  return { ok: true }
}

/**
 * One-click import of the legacy contractor_profiles.hourly_rate_min/max as
 * a "per hour" rate. Only runs when the professional has no rates yet, and
 * only when they click it — never automatically.
 */
export async function importLegacyHourlyRate(): Promise<RateResult> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_EXPIRED }

  const { data: existing, error: listErr } = await s.supabase
    .from('professional_rates')
    .select('id')
    .eq('contractor_id', s.userId)
    .limit(1)
  if (listErr) return { ok: false, error: dbError(listErr) }
  if (existing && existing.length > 0) {
    return { ok: false, error: 'You already have rates set up.' }
  }

  const { data: profile, error: profErr } = await s.supabase
    .from('contractor_profiles')
    .select('hourly_rate_min, hourly_rate_max')
    .eq('id', s.userId)
    .maybeSingle()
  if (profErr) return { ok: false, error: GENERIC }
  const form = legacyHourlyToForm(
    (profile?.hourly_rate_min as number | null) ?? null,
    (profile?.hourly_rate_max as number | null) ?? null
  )
  if (!form) return { ok: false, error: 'There’s no hourly rate on your profile to import.' }

  const parsed = rateFormSchema.safeParse(form)
  if (!parsed.success) return { ok: false, error: 'Your saved hourly rate couldn’t be imported.' }

  const { data, error } = await s.supabase
    .from('professional_rates')
    .insert({ ...parsed.data, contractor_id: s.userId, sort_order: 0 })
    .select(RATE_COLUMNS)
    .single()
  if (error || !data) return { ok: false, error: error ? dbError(error) : GENERIC }
  done()
  return { ok: true, rate: data as unknown as ProfessionalRate }
}
