// One shared definition of "how far along am I" for every surface that
// shows progress (dashboard profile card, Finish your profile card, profile
// editor, organization dashboard). Pure — safe on server and client.
//
// Readiness is measured from the role's checklist items
// (src/lib/onboarding/checklist-*.ts) as three separately named measures.
// They are never blended into one number, so optional enrichment can't
// inflate a required score:
//
//   Required for review        = needed_for_approval items done / total
//   Required to publish        = needed_after_approval items done / total
//   Optional profile improvements = stand_out items done / total
//
// Percentages are floored, so 100% only appears when every item in that
// measure is done. Completing a measure never means approved, published or
// visible: Sanus review (and, for listings, listing review) decides that.

import type { ChecklistGroup, ChecklistItem } from '@/lib/onboarding/checklist'

export type ReadinessMeasureId = 'required_for_review' | 'required_to_publish' | 'optional_profile'

export const READINESS_ORDER: ReadinessMeasureId[] = [
  'required_for_review',
  'required_to_publish',
  'optional_profile',
]

export const READINESS_MEASURES: Record<
  ReadinessMeasureId,
  { group: ChecklistGroup; label: string; required: boolean; completeNote: string; note: string }
> = {
  required_for_review: {
    group: 'needed_for_approval',
    label: 'Required for review',
    required: true,
    note: 'Sanus can review your application once these are done.',
    completeNote: 'Ready for Sanus review. This is not an approval.',
  },
  required_to_publish: {
    group: 'needed_after_approval',
    label: 'Required to publish',
    required: true,
    note: 'Needed before anything can be published. Publishing also requires Sanus approval.',
    completeNote: 'Done on your side. Visibility still depends on Sanus approval and listing review.',
  },
  optional_profile: {
    group: 'stand_out',
    label: 'Optional profile improvements',
    required: false,
    note: 'Optional. Helps people choose you; does not affect review or visibility.',
    completeNote: 'All optional improvements done.',
  },
}

export interface ReadinessMeasure {
  id: ReadinessMeasureId
  label: string
  required: boolean
  done: number
  total: number
  /** 0–100, floored; null when the measure has no items for this account. */
  percent: number | null
  complete: boolean
  /** Open items in this measure, in checklist order. */
  open: ChecklistItem[]
  note: string
}

export type Readiness = Record<ReadinessMeasureId, ReadinessMeasure>

/** Floored percent: never shows 100 while anything is left. */
export function readinessPercent(done: number, total: number): number | null {
  if (total <= 0) return null
  return Math.floor((Math.min(done, total) / total) * 100)
}

export function measureForGroup(group: ChecklistGroup): ReadinessMeasureId {
  return READINESS_ORDER.find((id) => READINESS_MEASURES[id].group === group) ?? 'optional_profile'
}

export function computeReadiness(items: ChecklistItem[]): Readiness {
  const out = {} as Readiness
  for (const id of READINESS_ORDER) {
    const cfg = READINESS_MEASURES[id]
    const inGroup = items.filter((i) => i.group === cfg.group)
    const done = inGroup.filter((i) => i.done).length
    const complete = done === inGroup.length
    out[id] = {
      id,
      label: cfg.label,
      required: cfg.required,
      done,
      total: inGroup.length,
      percent: readinessPercent(done, inGroup.length),
      complete,
      open: inGroup.filter((i) => !i.done),
      note: complete ? cfg.completeNote : cfg.note,
    }
  }
  return out
}

/** Measures that have at least one item for this account. */
export function presentMeasures(r: Readiness): ReadinessMeasure[] {
  return READINESS_ORDER.map((id) => r[id]).filter((m) => m.total > 0)
}

/** The next thing to do: first open, unlocked required item, else first open optional item. */
export function nextReadinessItem(r: Readiness): ChecklistItem | null {
  for (const id of READINESS_ORDER) {
    const item = r[id].open.find((i) => !i.locked)
    if (item) return item
  }
  return null
}

/** Short summary line, e.g. "Required for review: 1 of 2 done". */
export function measureSummary(m: ReadinessMeasure): string {
  return `${m.label}: ${m.done} of ${m.total} done`
}
