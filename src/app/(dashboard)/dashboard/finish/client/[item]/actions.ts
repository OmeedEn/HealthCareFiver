'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { recordProgress } from '@/lib/onboarding/progress'
import {
  CLIENT_BUDGET_VALUES,
  CLIENT_GOALS_MAX,
  CLIENT_LANGUAGE_MAX,
  CLIENT_NOTE_MAX,
} from '@/lib/onboarding/client-interests'
import { isClientFinishItem } from '@/lib/onboarding/checklist-client'
import type { ActionResult } from '@/components/onboarding/question-flow'

const text = (max: number, label: string) =>
  z.string().trim().min(1, `Add ${label}, or go back.`).max(max, `Keep it to ${max} characters.`)

// Each item's value → the column it fills. Mirrors the CHECK constraints in
// 20261016000400_client_single_question.sql.
const SCHEMAS = {
  zip: z.string().trim().regex(/^\d{5}$/, 'Enter a 5-digit ZIP code'),
  goals: text(CLIENT_GOALS_MAX, 'your goals'),
  language: text(CLIENT_LANGUAGE_MAX, 'a language'),
  budget: z.enum(CLIENT_BUDGET_VALUES, 'Choose a budget'),
  note: text(CLIENT_NOTE_MAX, 'a note'),
  phone: z
    .string()
    .trim()
    .max(32, PHONE_ERROR)
    .transform((v, ctx) => {
      const n = normalizeUsPhone(v)
      if (!n) {
        ctx.addIssue({ code: 'custom', message: PHONE_ERROR })
        return z.NEVER
      }
      return n
    }),
} as const

const COLUMN = { zip: 'zip_code', goals: 'goals', language: 'language', budget: 'budget', note: 'note' } as const

/** Saves one dashboard "Improve your matches" item for the signed-in client. */
export async function saveClientFinishItem(item: string, value: string): Promise<ActionResult> {
  if (!isClientFinishItem(item) || item === 'verify_email') return { ok: false, error: 'Unknown item' }
  const parsed = SCHEMAS[item].safeParse(value ?? '')
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Check your answer'
    return { ok: false, error: msg, fields: { value: msg } }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }

  // Own-row updates under RLS (client_profiles_update_own / profiles_update_own).
  const { error } =
    item === 'phone'
      ? await supabase.from('profiles').update({ phone: parsed.data }).eq('id', user.id)
      : await supabase
          .from('client_profiles')
          .update({ [COLUMN[item]]: parsed.data })
          .eq('id', user.id)
  if (error) {
    console.error('[finish/client] save failed', { item, code: error.code })
    return { ok: false, error: 'We couldn’t save that. Please try again.' }
  }

  // Progress is bookkeeping only; never fail the save over it.
  await recordProgress(supabase, user.id, 'client', { answered: [item] })
  return { ok: true }
}
