// "Finish your profile" checklist (Single-Question Onboarding spec). Each
// role builds its own items (src/lib/onboarding/checklist-*.ts) from profile
// data plus onboarding_progress.skipped; this file holds the shared shape,
// the group config, and the weighted percentage. Pure — safe on server and
// client.

export type ChecklistGroup = 'needed_for_approval' | 'needed_after_approval' | 'stand_out'

export interface ChecklistItem {
  /** Stable id (matches the question id when the item came from a skipped screen). */
  id: string
  group: ChecklistGroup
  label: string
  /** One short line under the label. */
  hint?: string
  done: boolean
  /** Opens the item: a single-question screen (/dashboard/finish/...) or an existing page. */
  href: string
  /** Not available yet (e.g. after-approval items before approval). Shown, not clickable. */
  locked?: boolean
}

export const CHECKLIST_GROUPS: Record<
  ChecklistGroup,
  { label: string; tag?: { text: string; tone: 'red' | 'amber' }; weight: number }
> = {
  needed_for_approval: { label: 'Needed for approval', tag: { text: 'Required', tone: 'red' }, weight: 0.5 },
  needed_after_approval: { label: 'Needed after approval', tag: { text: 'After approval', tone: 'amber' }, weight: 0.3 },
  stand_out: { label: 'Make your profile stand out', weight: 0.2 },
}

/** Client groups use different headings (spec: "Needed before inquiring or booking", "Improve your matches"). */
export type GroupLabels = Partial<Record<ChecklistGroup, string>>

export const GROUP_ORDER: ChecklistGroup[] = ['needed_for_approval', 'needed_after_approval', 'stand_out']

/**
 * Weighted completion, 0–100. Each group present contributes its weight
 * times its share of done items; groups with no items drop out and the
 * remaining weights are rescaled.
 */
export function checklistPercent(items: ChecklistItem[]): number {
  let total = 0
  let done = 0
  for (const g of GROUP_ORDER) {
    const inGroup = items.filter((i) => i.group === g)
    if (!inGroup.length) continue
    const w = CHECKLIST_GROUPS[g].weight
    total += w
    done += w * (inGroup.filter((i) => i.done).length / inGroup.length)
  }
  return total ? Math.round((done / total) * 100) : 100
}

/** Items still blocking approval: shown to staff as "Missing". */
export function missingForApproval(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => i.group === 'needed_for_approval' && !i.done)
}
