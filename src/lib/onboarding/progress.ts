import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// Single-Question Onboarding progress (onboarding_progress table,
// supabase/migrations/20261016000100_onboarding_progress.sql). Question ids
// come from each flow's config; answers themselves live in the profile
// columns. Pass the caller's own (RLS) client.

export type OnboardingFlow = 'professional' | 'organization' | 'client' | 'unsure'

export interface OnboardingProgress {
  answered: string[]
  skipped: string[]
  submitted_at: string | null
}

const EMPTY: OnboardingProgress = { answered: [], skipped: [], submitted_at: null }

export async function getProgress(
  supabase: SupabaseClient,
  userId: string,
  flow: OnboardingFlow
): Promise<OnboardingProgress> {
  const { data } = await supabase
    .from('onboarding_progress')
    .select('answered, skipped, submitted_at')
    .eq('user_id', userId)
    .eq('flow', flow)
    .maybeSingle()
  return data ? (data as OnboardingProgress) : EMPTY
}

/**
 * Record answered and/or skipped question ids. An answered id is removed
 * from `skipped` (finishing a skipped item from the dashboard checks it off);
 * a skipped id that was already answered stays answered.
 */
export async function recordProgress(
  supabase: SupabaseClient,
  userId: string,
  flow: OnboardingFlow,
  change: { answered?: string[]; skipped?: string[] }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getProgress(supabase, userId, flow)
  const answered = new Set(current.answered)
  for (const id of change.answered ?? []) answered.add(id)
  const skipped = new Set(current.skipped)
  for (const id of change.skipped ?? []) if (!answered.has(id)) skipped.add(id)
  for (const id of answered) skipped.delete(id)

  const { error } = await supabase.from('onboarding_progress').upsert(
    { user_id: userId, flow, answered: [...answered], skipped: [...skipped] },
    { onConflict: 'user_id,flow' }
  )
  if (error) {
    console.error('[onboarding/progress] save failed', { flow, code: error.code })
    return { ok: false, error: 'We couldn’t save your progress. Please try again.' }
  }
  return { ok: true }
}

export async function markSubmitted(
  supabase: SupabaseClient,
  userId: string,
  flow: OnboardingFlow
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Insert first without submitted_at (the insert policy only allows NULL),
  // then set it with an update — so this works whether or not the person
  // has a progress row yet.
  const { error: insertError } = await supabase
    .from('onboarding_progress')
    .upsert({ user_id: userId, flow }, { onConflict: 'user_id,flow', ignoreDuplicates: true })
  const { error } = insertError
    ? { error: insertError }
    : await supabase
        .from('onboarding_progress')
        .update({ submitted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('flow', flow)
  if (error) {
    console.error('[onboarding/progress] submit failed', { flow, code: error.code })
    return { ok: false, error: 'We couldn’t submit. Please try again.' }
  }
  return { ok: true }
}

/**
 * Index of the first screen to show: the first id that's neither answered
 * nor skipped. Everything handled → the last screen (usually submit).
 */
export function resumeIndex(screenIds: string[], progress: Pick<OnboardingProgress, 'answered' | 'skipped'>): number {
  const done = new Set([...progress.answered, ...progress.skipped])
  const i = screenIds.findIndex((id) => !done.has(id))
  return i === -1 ? Math.max(0, screenIds.length - 1) : i
}
