// "Finish your profile" checklist (Single-Question Onboarding spec). Each
// role builds its own items (src/lib/onboarding/checklist-*.ts) from profile
// data plus onboarding_progress.skipped; this file holds the shared shape
// and the group config. Progress numbers come from src/lib/readiness (one
// measure per group, never blended). Pure — safe on server and client.

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
  { label: string; tag?: { text: string; tone: 'red' | 'amber' } }
> = {
  // Labels match src/lib/readiness READINESS_MEASURES.
  needed_for_approval: { label: 'Required for review', tag: { text: 'Required', tone: 'red' } },
  needed_after_approval: { label: 'Required to publish', tag: { text: 'After approval', tone: 'amber' } },
  stand_out: { label: 'Optional profile improvements' },
}

/** Client groups use different headings (spec: "Needed before inquiring or booking", "Improve your matches"). */
export type GroupLabels = Partial<Record<ChecklistGroup, string>>

export const GROUP_ORDER: ChecklistGroup[] = ['needed_for_approval', 'needed_after_approval', 'stand_out']

/** Items still blocking approval: shown to staff as "Missing". */
export function missingForApproval(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => i.group === 'needed_for_approval' && !i.done)
}
