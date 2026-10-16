// Client "Finish your profile" checklist (Single-Question Onboarding spec,
// Dashboard items by path → Client). Pure — safe on server and client.
//
// Client groups reuse the shared group keys with their own headings:
//   needed_for_approval → "Needed before inquiring or booking"
//   stand_out           → "Improve your matches (optional)"

import type { ChecklistItem, GroupLabels } from './checklist'

export const CLIENT_GROUP_LABELS: GroupLabels = {
  needed_for_approval: 'Needed before inquiring or booking',
  stand_out: 'Improve your matches (optional)',
}

export const CLIENT_FINISH_ITEMS = [
  'verify_email',
  'zip',
  'goals',
  'language',
  'budget',
  'note',
  'phone',
] as const
export type ClientFinishItem = (typeof CLIENT_FINISH_ITEMS)[number]

export function isClientFinishItem(v: unknown): v is ClientFinishItem {
  return typeof v === 'string' && (CLIENT_FINISH_ITEMS as readonly string[]).includes(v)
}

export const clientFinishHref = (item: ClientFinishItem) => `/dashboard/finish/client/${item}`

export interface ClientChecklistInput {
  emailConfirmed: boolean
  zip_code: string | null
  goals: string | null
  language: string | null
  budget: string | null
  note: string | null
  phone: string | null
}

export function buildClientChecklist(c: ClientChecklistInput): ChecklistItem[] {
  const item = (
    id: ClientFinishItem,
    group: ChecklistItem['group'],
    label: string,
    done: boolean,
    hint?: string
  ): ChecklistItem => ({ id, group, label, hint, done, href: clientFinishHref(id) })

  return [
    item('verify_email', 'needed_for_approval', 'Verify your email', c.emailConfirmed, 'Confirm the link we emailed you.'),
    item('zip', 'stand_out', 'Add your ZIP code', !!c.zip_code, 'Shows professionals near you.'),
    item('goals', 'stand_out', 'Your goals', !!c.goals),
    item('language', 'stand_out', 'Language preference', !!c.language),
    item('budget', 'stand_out', 'Budget per session', !!c.budget),
    item('note', 'stand_out', 'Anything else we should know', !!c.note, '200 characters, no medical details.'),
    item('phone', 'stand_out', 'Phone number for reminders', !!c.phone),
  ]
}
